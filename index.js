#!/usr/bin/env node

import os from 'os';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';

import { 
    ensureTempDir, 
    writeLog, 
    checkAdmin, 
    logFile,
    loadState,
    saveState
} from './src/utils/helpers.js';
import { loadConfig } from './src/utils/config.js';

import { runSlopRemoval } from './src/tasks/slop.js';
import { runHardwareCheck } from './src/tasks/systemInfo.js';
import { 
    runWindowsUpdates, 
    runWingetUpdates, 
    runChocoUpdates 
} from './src/tasks/updates.js';
import { 
    runDismCheck, 
    runSfcScan, 
    runDiskOptimization 
} from './src/tasks/maintenance.js';
import { 
    runTempFileCleanup, 
    runDnsFlush, 
    runRecycleBinCleanup, 
    runDiskCleanup,
    runWindowsUpdateCacheCleanup
} from './src/tasks/cleanup.js';
import { runNetworkRepair } from './src/tasks/network.js';
import { runCuttingEdgeEnhancements } from './src/tasks/cuttingEdge.js';

const argv = yargs(hideBin(process.argv))
  .option('silent', {
    alias: 's',
    type: 'boolean',
    description: 'Run in non-interactive mode',
  })
  .option('yes', {
    alias: 'y',
    type: 'boolean',
    description: 'Automatically answer yes to all prompts (Yes to All)',
    default: false,
  })
  .option('tasks', {
    alias: 't',
    type: 'array',
    description: 'Specify which tasks to run (e.g., -t network dns)',
  })
  .option('info', {
    alias: 'i',
    type: 'boolean',
    description: 'Show system information and exit',
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Force running all tasks, bypassing the last run throttle in silent mode',
    default: false,
  })
  .option('no-throttle', {
    type: 'boolean',
    description: 'Disable the last run throttle checks entirely',
    default: false,
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to a custom configuration JSON file',
  })
  .argv;

async function main() {
    await ensureTempDir();
    if (os.platform() !== 'win32') {
        console.error(chalk.red('ERROR: This tool is designed for Windows system maintenance only.'));
        process.exit(1);
    }

    console.log(chalk.bold.cyan('=== Winslopr: Windows Slop Remover & Maintenance Tool ===\n'));
    await writeLog('Winslopr started.');

    const config = await loadConfig(argv.config);

    if (argv.info) {
        await runHardwareCheck();
        process.exit(0);
    }

    await checkAdmin();

    const tasks = {
        slop: { name: config.slop.name, task: () => runSlopRemoval(), checked: config.slop.checked },
        hwInfo: { name: config.hwInfo.name, task: () => runHardwareCheck(), checked: config.hwInfo.checked },
        winUpdate: { name: config.winUpdate.name, task: () => runWindowsUpdates(argv), checked: config.winUpdate.checked },
        winget: { name: config.winget.name, task: () => runWingetUpdates(argv), checked: config.winget.checked },
        choco: { name: config.choco.name, task: () => runChocoUpdates(argv), checked: config.choco.checked },
        dism: { name: config.dism.name, task: () => runDismCheck(), checked: config.dism.checked },
        sfc: { name: config.sfc.name, task: () => runSfcScan(), checked: config.sfc.checked },
        cleanup: { name: config.cleanup.name, task: () => runTempFileCleanup(), checked: config.cleanup.checked },
        recyclebin: { name: config.recyclebin.name, task: () => runRecycleBinCleanup(), checked: config.recyclebin.checked },
        cuttingEdge: { name: config.cuttingEdge.name, task: () => runCuttingEdgeEnhancements(argv), checked: config.cuttingEdge.checked },
        diskcleanup: { name: config.diskcleanup.name, task: () => runDiskCleanup(), checked: config.diskcleanup.checked },
        wucleanup: { name: config.wucleanup.name, task: () => runWindowsUpdateCacheCleanup(), checked: config.wucleanup.checked },
        dns: { name: config.dns.name, task: () => runDnsFlush(), checked: config.dns.checked },
        network: { name: config.network.name, task: () => runNetworkRepair(argv), checked: config.network.checked },
        optimize: { name: config.optimize.name, task: () => runDiskOptimization(), checked: config.optimize.checked },
    };

    const taskAliases = {
        clean: ['cleanup', 'recyclebin', 'diskcleanup'],
        cleanit: ['cleanup', 'recyclebin', 'diskcleanup'],
        'clean-it': ['cleanup', 'recyclebin', 'diskcleanup'],
        cleanup: ['cleanup'],
        temp: ['cleanup'],
        slop: ['slop'],
        debloat: ['slop'],
        update: ['winUpdate', 'winget', 'choco'],
        updates: ['winUpdate', 'winget', 'choco'],
        dism: ['dism'],
        sfc: ['sfc'],
        dns: ['dns'],
        net: ['network'],
        network: ['network'],
        optimize: ['optimize'],
        trim: ['optimize'],
        wucleanup: ['wucleanup']
    };

    const requestedTasks = [];
    if (argv._ && argv._.length > 0) {
        requestedTasks.push(...argv._.map(String));
    }
    if (argv.tasks && argv.tasks.length > 0) {
        requestedTasks.push(...argv.tasks.map(String));
    }

    let tasksToRun = [];
    if (requestedTasks.length > 0) {
        for (const req of requestedTasks) {
            const lower = req.toLowerCase();
            if (taskAliases[lower]) {
                tasksToRun.push(...taskAliases[lower]);
            } else if (tasks[lower]) {
                tasksToRun.push(lower);
            } else if (tasks[req]) {
                tasksToRun.push(req);
            }
        }
        tasksToRun = [...new Set(tasksToRun)];
    } else if (argv.silent) {
        tasksToRun = Object.keys(tasks).filter(key => tasks[key].checked);
    } else {
        const response = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedTasks',
                message: 'Please select the maintenance tasks to run:',
                choices: Object.entries(tasks).map(([key, value]) => ({
                    name: value.name,
                    value: key,
                    checked: value.checked,
                })),
            },
        ]);
        tasksToRun = response.selectedTasks;
    }

    if (tasksToRun.length === 0) {
        console.log(chalk.yellow('No tasks selected. Exiting.'));
        return;
    }
    
    console.log(''); // Add a newline for spacing

    const state = await loadState();
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    const throttleIntervals = {};
    for (const [key, value] of Object.entries(config)) {
        throttleIntervals[key] = value.intervalDays * msInDay;
    }

    const isThrottledSession = argv.silent && !argv.force && !argv['no-throttle'] && !argv.noThrottle;

    // Run tasks sequentially to prevent console output overlap
    for (const taskKey of tasksToRun) {
        if (!tasks[taskKey]) continue;

        const interval = throttleIntervals[taskKey] || 0;
        const lastRun = state[taskKey] ? new Date(state[taskKey]).getTime() : 0;

        if (isThrottledSession && interval > 0 && lastRun > 0 && (now - lastRun < interval)) {
            const lastRunStr = new Date(lastRun).toLocaleString();
            const daysLeft = ((interval - (now - lastRun)) / msInDay).toFixed(1);
            console.log(chalk.yellow(`[SKIPPED] ${tasks[taskKey].name} - Recently run on ${lastRunStr} (Next run in ${daysLeft} days)`));
            await writeLog(`Task [${taskKey}] skipped due to throttle. Last run: ${lastRunStr}`);
            continue;
        }

        console.log(chalk.bold.cyan('\n>> Running Task: ' + tasks[taskKey].name));
        const success = await tasks[taskKey].task();

        if (success !== false) {
            state[taskKey] = new Date().toISOString();
            await saveState(state);
        }
    }

    console.log(chalk.bold.green('\n=== MAINTENANCE COMPLETE ==='));
    console.log(chalk.gray(`Log file created at: ${logFile}`));
}

main().catch(async (err) => {
    console.error(chalk.red(`\nCRITICAL ERROR: ${err.message}`));
    await writeLog(`Critical script error: ${err.message}`, 'ERROR');
    process.exit(1);
});
