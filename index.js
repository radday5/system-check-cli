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
    logFile 
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
    runDiskCleanup 
} from './src/tasks/cleanup.js';
import { runNetworkRepair } from './src/tasks/network.js';

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
        diskcleanup: { name: 'Run Windows Disk Cleanup (Cleanmgr)', task: () => runDiskCleanup(), checked: false },
        dns: { name: 'Flush DNS Cache', task: () => runDnsFlush(), checked: true },
        network: { name: 'Repair Network Stack & Reset Adapters', task: () => runNetworkRepair(argv), checked: true },
        optimize: { name: 'Optimize All Fixed Drives (Trim/Defrag)', task: () => runDiskOptimization(), checked: false },
    };

    let tasksToRun = Object.keys(tasks);

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

    // Run tasks sequentially to prevent console output overlap
    for (const taskKey of tasksToRun) {
        if (tasks[taskKey]) {
            await tasks[taskKey].task();
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
