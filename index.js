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
  .argv;

async function main() {
    await ensureTempDir();
    if (os.platform() !== 'win32') {
        console.error(chalk.red('ERROR: This tool is designed for Windows system maintenance only.'));
        process.exit(1);
    }

    console.log(chalk.bold.cyan('=== Winslopr: Windows Slop Remover & Maintenance Tool ===\n'));
    await writeLog('Winslopr started.');

    if (argv.info) {
        await runHardwareCheck();
        process.exit(0);
    }

    await checkAdmin();

    const tasks = {
        slop: { name: 'Remove Windows Slop (AI, Telemetry, Bing)', task: () => runSlopRemoval(), checked: true },
        hwInfo: { name: 'Gather Hardware & OS Information', task: () => runHardwareCheck(), checked: true },
        winUpdate: { name: 'Check & Install Windows Updates', task: () => runWindowsUpdates(argv), checked: true },
        winget: { name: 'Update Winget Software', task: () => runWingetUpdates(argv), checked: true },
        choco: { name: 'Update Chocolatey Software', task: () => runChocoUpdates(argv), checked: true },
        dism: { name: 'Check DISM Health', task: () => runDismCheck(), checked: true },
        sfc: { name: 'Run System File Checker (SFC)', task: () => runSfcScan(), checked: true },
        cleanup: { name: 'Clean Temporary Files', task: () => runTempFileCleanup(), checked: true },
        recyclebin: { name: 'Empty Recycle Bin', task: () => runRecycleBinCleanup(), checked: true },
        cuttingEdge: { name: 'Cutting-Edge Windows 11 Enhancements (HAGS, Sudo, Xbox Mode)', task: () => runCuttingEdgeEnhancements(argv), checked: true },
        diskcleanup: { name: 'Run Windows Disk Cleanup (Cleanmgr)', task: () => runDiskCleanup(), checked: false },
        wucleanup: { name: 'Clean Windows Update Download Cache', task: () => runWindowsUpdateCacheCleanup(), checked: true },
        dns: { name: 'Flush DNS Cache', task: () => runDnsFlush(), checked: true },
        network: { name: 'Repair Network Stack & Reset Adapters', task: () => runNetworkRepair(argv), checked: true },
        optimize: { name: 'Optimize All Fixed Drives (Trim/Defrag)', task: () => runDiskOptimization(), checked: false },
    };

    let tasksToRun = Object.keys(tasks).filter(key => tasks[key].checked);

    if (argv.tasks && argv.tasks.length > 0) {
        tasksToRun = argv.tasks.filter(t => tasks[t]);
    } else if (!argv.silent) {
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
    const throttleIntervals = {
        slop: 0,
        hwInfo: 0,
        dns: 0,
        cleanup: 1 * msInDay,
        recyclebin: 1 * msInDay,
        cuttingEdge: 3 * msInDay,
        winget: 3 * msInDay,
        choco: 3 * msInDay,
        winUpdate: 7 * msInDay,
        network: 7 * msInDay,
        dism: 14 * msInDay,
        sfc: 14 * msInDay,
        diskcleanup: 14 * msInDay,
        wucleanup: 14 * msInDay,
        optimize: 14 * msInDay,
    };

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
