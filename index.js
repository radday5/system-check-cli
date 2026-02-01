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
        const scriptPath = path.join(os.tmpdir(), `ps-script-${Date.now()}.ps1`);
        await fs.writeFile(scriptPath, psScript);
        try {
            const { stdout } = await runCommand('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
            return { message: stdout.trim() };
        } finally {
            await fs.unlink(scriptPath).catch(err => writeLog(`Failed to delete temp script: ${err.message}`, 'WARN'));
        }
    });
}

async function runWingetUpdates() {
    return runTask('Updating Winget Software', async () => {
        await runCommand('winget', ['source', 'update']);
        console.log(chalk.yellow('\n  Use `winget upgrade` to view packages and `winget upgrade --all` to install all updates.'));
    });
}

async function runChocoUpdates() {
    return runTask('Updating Chocolatey Software', async () => {
        try {
            await runCommand('choco', ['--version']);
        } catch (error) {
            throw new Error('Chocolatey is not installed or not in your PATH. Please install Chocolatey to use this feature.');
        }
        await runCommand('choco', ['outdated']);
        console.log(chalk.yellow('\n  Use `choco upgrade all -y` to upgrade all outdated packages.'));
    });
}

async function runDismCheck() {
    return runTask('Checking DISM Health', async () => {
        await runCommand('Dism.exe', ['/Online', '/Cleanup-Image', '/CheckHealth']);
    });
}

async function runSfcScan() {
    return runTask('Running System File Checker (sfc /scannow)', async () => {
        try {
            await runCommand('sfc', ['/scannow']);
        } catch (error) {
            if (error.message.includes('exit code 1')) {
                throw new Error(`sfc /scannow failed. This may indicate that Windows Resource Protection found integrity violations.\n  Please check the CBS.log for more details: C:\\Windows\\Logs\\CBS\\CBS.log`);
            }
            throw error;
        }
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

async function runHardwareCheck() {
    const spinner = ora('Gathering Hardware & OS Information').start();
    try {
        const psScript = `
            # Get OS Information
            $os = Get-CimInstance -ClassName Win32_OperatingSystem
            $osInfo = @{
                Caption = $os.Caption
                Version = $os.Version
                BuildNumber = $os.BuildNumber
            }

            # Get CPU Information
            $cpu = Get-CimInstance -ClassName Win32_Processor
            $cpuInfo = @{
                Name = $cpu.Name
                Manufacturer = $cpu.Manufacturer
                MaxClockSpeed = $cpu.MaxClockSpeed
                NumberOfCores = $cpu.NumberOfCores
                NumberOfLogicalProcessors = $cpu.NumberOfLogicalProcessors
            }

            # Get GPU Information
            $gpu = Get-CimInstance -ClassName Win32_VideoController | Select-Object -First 1
            $gpuInfo = @{
                Name = $gpu.Name
                AdapterRAM = $gpu.AdapterRAM / 1MB
            }

            # Get RAM Information
            $ram = Get-CimInstance -ClassName Win32_ComputerSystem
            $ramInfo = @{
                TotalPhysicalMemory = [math]::Round($ram.TotalPhysicalMemory / 1GB)
            }

            # Get Motherboard Information
            $mb = Get-CimInstance -ClassName Win32_BaseBoard
            $mbInfo = @{
                Manufacturer = $mb.Manufacturer
                Product = $mb.Product
            }

            # Combine all info into a single object
            $systemInfo = @{
                OS = $osInfo
                CPU = $cpuInfo
                GPU = $gpuInfo
                RAM = $ramInfo
                Motherboard = $mbInfo
            }

            # Convert to JSON and write to output
            $systemInfo | ConvertTo-Json
        `;
        const scriptPath = path.join(os.tmpdir(), `hw-info-${Date.now()}.ps1`);
        await fs.writeFile(scriptPath, psScript);
        
        const { stdout } = await runCommand('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
        const systemInfo = JSON.parse(stdout);
        await fs.unlink(scriptPath).catch(err => writeLog(`Failed to delete temp script: ${err.message}`, 'WARN'));

        let output = chalk.bold.cyan('\n--- System Information ---\n');
        output += chalk.bold('OS:') + `\n  - ${systemInfo.OS.Caption} (Version: ${systemInfo.OS.Version}, Build: ${systemInfo.OS.BuildNumber})\n`;
        output += chalk.bold('CPU:') + `\n  - ${systemInfo.CPU.Name}\n    - Cores: ${systemInfo.CPU.NumberOfCores}, Logical Processors: ${systemInfo.CPU.NumberOfLogicalProcessors}\n    - Max Speed: ${systemInfo.CPU.MaxClockSpeed} MHz\n`;
        if (systemInfo.GPU) {
            output += chalk.bold('GPU:') + `\n  - ${systemInfo.GPU.Name}\n    - VRAM: ${systemInfo.GPU.AdapterRAM} MB\n`;
        }
        output += chalk.bold('RAM:') + `\n  - Total: ${systemInfo.RAM.TotalPhysicalMemory} GB\n`;
        output += chalk.bold('Motherboard:') + `\n  - ${systemInfo.Motherboard.Manufacturer} ${systemInfo.Motherboard.Product}\n`;
        output += chalk.bold.cyan('------------------------');
        
        spinner.succeed(chalk.green('Gathered Hardware & OS Information'));
        console.log(output);
        await writeLog('Gathered Hardware & OS Information', 'INFO');
        return true;
    } catch (error) {
        spinner.fail(chalk.red('Gathering Hardware & OS Information'));
        console.error(chalk.red('  ' + error.message.replace(/\n/g, '\n  ')));
        await writeLog(`Hardware & OS Information failed: ${error.message}`, 'ERROR');
        return false;
    }
}


async function main() {
    console.log(chalk.bold.cyan('=== Windows System Maintenance Tool (Node.js) ===\n'));
    await writeLog('Script started.');

    await checkAdmin();

    const tasks = {
        hwInfo: { name: 'Gather Hardware & OS Information', task: runHardwareCheck, checked: true },
        winUpdate: { name: 'Check for Windows Updates', task: runWindowsUpdateCheck, checked: true },
        winget: { name: 'Update Winget Software', task: runWingetUpdates, checked: true },
        choco: { name: 'Update Chocolatey Software', task: runChocoUpdates, checked: true },
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
