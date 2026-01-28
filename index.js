#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const execAsync = promisify(exec);

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
        console.log(chalk.gray(`> ${command} ${args.join(' ')}`));
        const child = spawn(command, args, { stdio: 'pipe', shell: true });

        child.stdout.on('data', (data) => {
            process.stdout.write(chalk.gray(data.toString()));
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(chalk.red(data.toString()));
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(code);
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}


async function checkAdmin() {
    try {
        await execAsync('net session');
        console.log(chalk.green('Running as Administrator: OK'));
        await writeLog('Running as Administrator: OK');
        return true;
    } catch (error) {
        console.error(chalk.red('ERROR: This script requires Administrator privileges!'));
        console.log(chalk.yellow('Please re-run your terminal (PowerShell, Command Prompt, etc.) as an Administrator.'));
        await writeLog('ERROR: Script not running as Administrator.', 'ERROR');
        process.exit(1);
    }
}

async function runWingetUpdates() {
    console.log(chalk.cyan('\n=== STEP 1: Updating Winget Software ==='));
    await writeLog('Starting Winget software update');
    try {
        console.log('Checking for winget...');
        await execAsync('winget --version');
        console.log('Updating winget sources...');
        await runCommand('winget', ['source', 'update']);
        console.log('Checking for available package updates...');
        
        if (argv.silent) {
            console.log(chalk.yellow('Installing all available winget packages in silent mode...'));
            await runCommand('winget', ['upgrade', '--all', '--accept-package-agreements', '--accept-source-agreements', '--silent']);
            console.log(chalk.green('Winget packages update command executed.'));
        } else {
             console.log(chalk.yellow('Use `winget upgrade` to view packages and `winget upgrade --all` to install all updates.'));
        }
    } catch (error) {
        console.error(chalk.red('Winget check failed. Please ensure it is installed and in your PATH.'));
        await writeLog(`Winget error: ${error.message}`, 'ERROR');
    }
}

async function runDismCheck() {
    console.log(chalk.cyan('\n=== STEP 2: Checking DISM Health ==='));
    await writeLog('Starting DISM health check');
    try {
        await runCommand('Dism.exe', ['/Online', '/Cleanup-Image', '/CheckHealth']);
        console.log(chalk.green('DISM health check completed successfully.'));
        await writeLog('DISM health check successful');
    } catch (error) {
        console.error(chalk.yellow('DISM health check reported issues or failed.'));
        console.log(chalk.yellow("Consider running 'DISM /Online /Cleanup-Image /ScanHealth' and 'DISM /Online /Cleanup-Image /RestoreHealth'"));
        await writeLog(`DISM error: ${error.message}`, 'ERROR');
    }
}

async function runSfcScan() {
    console.log(chalk.cyan('\n=== STEP 3: Running System File Checker ==='));
    await writeLog('Starting SFC scan');
    try {
        console.log(chalk.yellow('Running sfc /scannow... This may take some time.'));
        await runCommand('sfc', ['/scannow']);
        console.log(chalk.green('SFC scan completed successfully.'));
        await writeLog('SFC scan successful');
    } catch (error) {
        console.error(chalk.yellow('SFC scan completed with errors or requires a reboot.'));
        await writeLog(`SFC scan error: ${error.message}`, 'ERROR');
    }
}

async function main() {
    console.log(chalk.bold.cyan('=== Windows System Maintenance Tool (Node.js) ==='));
    await writeLog('Script started.');

    await checkAdmin();
    
    await runWingetUpdates();
    await runDismCheck();
    await runSfcScan();

    console.log(chalk.bold.green('\n=== MAINTENANCE COMPLETE ==='));
    console.log(chalk.gray(`Log file created at: ${logFile}`));
}

main().catch(async (err) => {
    console.error(chalk.red(`\nCRITICAL ERROR: ${err.message}`));
    await writeLog(`Critical script error: ${err.message}`, 'ERROR');
    process.exit(1);
});
