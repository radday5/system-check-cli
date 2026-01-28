#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';

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
        await task();
        spinner.succeed(chalk.green(spinner.text));
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

async function runWingetUpdates() {
    return runTask('Updating Winget Software', async () => {
        await runCommand('winget', ['source', 'update']);
        if (argv.silent) {
            await runCommand('winget', ['upgrade', '--all', '--accept-package-agreements', '--accept-source-agreements', '--silent', '--disable-interactivity']);
        } else {
            console.log(chalk.yellow('\n  Run `winget upgrade` to view packages and `winget upgrade --all` to install all updates.'));
        }
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
