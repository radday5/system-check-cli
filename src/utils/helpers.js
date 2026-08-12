import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';

export const toolTempDir = path.join(os.tmpdir(), 'SystemMaintenance-Scripts');
export const logFile = path.join(toolTempDir, `SystemMaintenance-${new Date().toISOString().replace(/:/g, '-')}.log`);
export const stateFile = path.join(process.env.LOCALAPPDATA || os.homedir(), 'winslopr-state.json');

export async function loadState() {
    try {
        const data = await fs.readFile(stateFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

export async function saveState(state) {
    try {
        await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
        await writeLog(`Failed to save state: ${err.message}`, 'WARN');
    }
}

export async function ensureTempDir() {
    try {
        await fs.mkdir(toolTempDir, { recursive: true });
    } catch (err) {
        // Ignore errors if directory exists
    }
}

export async function writeLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}${os.EOL}`;
    try {
        await fs.appendFile(logFile, logEntry);
    } catch (err) {
        // Silently fail logging if file is inaccessible
    }
}

export async function runCommand(command, args = [], options = {}) {
    const { stream = false, ...spawnOptions } = options;
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: stream ? 'inherit' : 'pipe', shell: true, ...spawnOptions });
        let stdout = '';
        let stderr = '';

        if (!stream && child.stdout) {
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
        }

        if (!stream && child.stderr) {
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
        }

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                const errorMsg = stream ? `Command failed with exit code ${code}` : `Command failed with exit code ${code}\n${stderr}`;
                const err = new Error(errorMsg);
                err.code = code;
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
            }
        });

        child.on('error', (err) => {
            if (err.code === 'ETIMEDOUT') {
                reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
            } else {
                reject(err);
            }
        });
    });
}

export async function runPowerShell(script) {
    const scriptPath = path.join(toolTempDir, `ps-script-${Date.now()}-${Math.floor(Math.random() * 1000)}.ps1`);
    await fs.writeFile(scriptPath, script);
    try {
        return await runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
    } finally {
        await fs.unlink(scriptPath).catch(err => writeLog(`Failed to delete temp script: ${err.message}`, 'DEBUG'));
    }
}

export async function runTask(title, task) {
    const startTime = Date.now();
    const isInteractive = Boolean(process.stdout.isTTY);
    const spinner = ora({ text: title, isSilent: !isInteractive }).start();
    try {
        const result = await task();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (result && result.message) {
            spinner.succeed(chalk.green(`${spinner.text} - ${result.message} (${duration}s)`));
        } else {
            spinner.succeed(chalk.green(`${spinner.text} (${duration}s)`));
        }
        
        await writeLog(`${title} completed in ${duration}s`, 'INFO');
        return true;
    } catch (error) {
        spinner.fail(chalk.red(spinner.text));
        console.error(chalk.red('  ' + error.message.replace(/\n/g, '\n  ')));
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        await writeLog(`${title} failed after ${duration}s: ${error.message}`, 'ERROR');
        return false;
    }
}

export async function checkAdmin() {
    const isInteractive = Boolean(process.stdout.isTTY);
    const spinner = ora({ text: 'Checking for Administrator privileges', isSilent: !isInteractive }).start();
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

