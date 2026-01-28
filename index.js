#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import inquirer from 'inquirer';

const argv = yargs(hideBin(process.argv))
  .option('silent', {
    alias: 's',
    type: 'boolean',
    description: 'Run in non-interactive mode',
  })
  .argv;

const logFile = path.join(os.tmpdir(), `SystemMaintenance-${new Date().toISOString().replace(/:/g, '-')}.log`);

async function writeLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}${os.EOL}`;
    await fs.appendFile(logFile, logEntry);
}

function runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'pipe', shell: true });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

async function runTask(title, task) {
    const spinner = ora(title).start();
    try {
        const result = await task();
        if (result && result.message) {
            spinner.succeed(chalk.green(`${spinner.text} - ${result.message}`));
        } else {
            spinner.succeed(chalk.green(spinner.text));
        }
        return true;
    } catch (error) {
        spinner.fail(chalk.red(spinner.text));
        console.error(chalk.red('  ' + error.message.replace(/\n/g, '\n  ')));
        await writeLog(`${title} failed: ${error.message}`, 'ERROR');
        return false;
    }
}


async function checkAdmin() {
    const spinner = ora('Checking for Administrator privileges').start();
    try {
        await runCommand('net', ['session']);
        spinner.succeed(chalk.green('Running as Administrator: OK'));
        await writeLog('Running as Administrator: OK');
    } catch (error) {
        spinner.fail(chalk.red('Administrator privileges check failed.'));
        console.error(chalk.red('ERROR: This script requires Administrator privileges!'));
        console.log(chalk.yellow('Please re-run your terminal (PowerShell, Command Prompt, etc.) as an Administrator.'));
        await writeLog('ERROR: Script not running as Administrator.', 'ERROR');
        process.exit(1);
    }
}

async function runWindowsUpdateCheck() {
    return runTask('Checking for Windows Updates', async () => {
        const psScript = `
            $updateSession = New-Object -ComObject Microsoft.Update.Session
            $updateSearcher = $updateSession.CreateUpdateSearcher()
            $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0")
            if ($searchResult.Updates.Count -gt 0) {
                Write-Host "Found $($searchResult.Updates.Count) update(s)."
            } else {
                Write-Host "No updates found."
            }
        `;
        const { stdout } = await runCommand('powershell.exe', ['-Command', psScript]);
        return { message: stdout.trim() };
    });
}

async function runWingetUpdates() {
    return runTask('Updating Winget Software', async () => {
        await runCommand('winget', ['source', 'update']);
        console.log(chalk.yellow('\n  Use `winget upgrade` to view packages and `winget upgrade --all` to install all updates.'));
    });
}

async function runDismCheck() {
    return runTask('Checking DISM Health', async () => {
        await runCommand('Dism.exe', ['/Online', '/Cleanup-Image', '/CheckHealth']);
    });
}

async function runSfcScan() {
    return runTask('Running System File Checker (sfc /scannow)', async () => {
        await runCommand('sfc', ['/scannow']);
    });
}

async function runTempFileCleanup() {
    return runTask('Cleaning Temporary Files', async () => {
        const tempPaths = [os.tmpdir(), 'C:\\Windows\\Temp'];
        for (const tempPath of tempPaths) {
            try {
                await writeLog(`Cleaning folder: ${tempPath}`);
                const files = await fs.readdir(tempPath);
                for (const file of files) {
                    const filePath = path.join(tempPath, file);
                    await fs.rm(filePath, { recursive: true, force: true }).catch(err => {
                        writeLog(`Could not delete ${filePath}: ${err.message}`, 'WARN');
                    });
                }
            } catch (err) {
                await writeLog(`Could not access temp path ${tempPath}: ${err.message}`, 'WARN');
            }
        }
    });
}

async function runDiskOptimization() {
    return runTask('Optimizing System Drive (C:)', async () => {
        await runCommand('powershell.exe', ['-Command', 'Optimize-Volume -DriveLetter C']);
    });
}


async function main() {
    console.log(chalk.bold.cyan('=== Windows System Maintenance Tool (Node.js) ===\n'));
    await writeLog('Script started.');

    await checkAdmin();

    const tasks = {
        winUpdate: { name: 'Check for Windows Updates', task: runWindowsUpdateCheck, checked: true },
        winget: { name: 'Update Winget Software', task: runWingetUpdates, checked: true },
        dism: { name: 'Check DISM Health', task: runDismCheck, checked: true },
        sfc: { name: 'Run System File Checker (SFC)', task: runSfcScan, checked: true },
        cleanup: { name: 'Clean Temporary Files', task: runTempFileCleanup, checked: true },
        optimize: { name: 'Optimize System Drive', task: runDiskOptimization, checked: false },
    };

    let tasksToRun = Object.keys(tasks);

    if (!argv.silent) {
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
