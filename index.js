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
  .option('yes', {
    alias: 'y',
    type: 'boolean',
    description: 'Automatically answer yes to all prompts (Yes to All)',
    default: false,
  })
  .argv;

const logFile = path.join(os.tmpdir(), `SystemMaintenance-${new Date().toISOString().replace(/:/g, '-')}.log`);

async function writeLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}${os.EOL}`;
    try {
        await fs.appendFile(logFile, logEntry);
    } catch (err) {
        // Silently fail logging if file is inaccessible
    }
}

function runCommand(command, args = [], options = {}) {
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
                reject(new Error(errorMsg));
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

async function runWindowsUpdates() {
    return runTask('Checking & Installing Windows Updates', async () => {
        const checkScript = `
            $updateSession = New-Object -ComObject Microsoft.Update.Session
            $updateSearcher = $updateSession.CreateUpdateSearcher()
            $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0")
            if ($searchResult.Updates.Count -gt 0) {
                Write-Host "Found $($searchResult.Updates.Count) update(s)."
                $searchResult.Updates | ForEach-Object { Write-Host " - $($_.Title)" }
            } else {
                Write-Host "No updates found."
            }
        `;
        const scriptPath = path.join(os.tmpdir(), `ps-check-${Date.now()}.ps1`);
        await fs.writeFile(scriptPath, checkScript);
        let foundUpdates = false;
        try {
            const { stdout } = await runCommand('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
            console.log(chalk.gray('\n' + stdout.trim()));
            foundUpdates = stdout.includes('Found');
            if (!foundUpdates) return { message: 'System is up to date.' };
        } finally {
            await fs.unlink(scriptPath).catch(() => {});
        }

        if (foundUpdates) {
            let confirm = argv.yes;
            if (!confirm && !argv.silent) {
                const response = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'install',
                    message: 'Do you want to download and install these updates?',
                    default: true
                }]);
                confirm = response.install;
            }

            if (confirm) {
                console.log(chalk.yellow('  Downloading and installing updates... (This may take a while)'));
                const installScript = `
                    $updateSession = New-Object -ComObject Microsoft.Update.Session
                    $updateSearcher = $updateSession.CreateUpdateSearcher()
                    $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0")
                    if ($searchResult.Updates.Count -gt 0) {
                        $downloader = $updateSession.CreateUpdateDownloader()
                        $downloader.Updates = $searchResult.Updates
                        Write-Host "Downloading updates..."
                        $downloader.Download()
                        
                        $installer = $updateSession.CreateUpdateInstaller()
                        $installer.Updates = $searchResult.Updates
                        Write-Host "Installing updates..."
                        $installResult = $installer.Install()
                        Write-Host "Installation Result Code: $($installResult.ResultCode)"
                        if ($installResult.RebootRequired) { Write-Host "REBOOT_REQUIRED" }
                    }
                `;
                const iScriptPath = path.join(os.tmpdir(), `ps-install-${Date.now()}.ps1`);
                await fs.writeFile(iScriptPath, installScript);
                try {
                    const { stdout } = await runCommand('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', iScriptPath]);
                    if (stdout.includes('REBOOT_REQUIRED')) {
                        console.log(chalk.bold.red('\n  *** REBOOT REQUIRED to complete updates ***'));
                    }
                    return { message: 'Installation attempt finished.' };
                } finally {
                    await fs.unlink(iScriptPath).catch(() => {});
                }
            } else {
                return { message: 'Updates skipped by user.' };
            }
        }
    });
}

async function runWingetUpdates() {
    return runTask('Updating Winget Software', async () => {
        await runCommand('winget', ['source', 'update']);
        
        const { stdout } = await runCommand('winget', ['upgrade']);
        if (stdout.includes('No installed package found matching input criteria') || stdout.includes('No available upgrade found')) {
            return { message: 'All Winget packages are up to date.' };
        }
        
        console.log(chalk.gray('\n' + stdout.trim()));

        let confirm = argv.yes;
        if (!confirm && !argv.silent) {
            const response = await inquirer.prompt([{
                type: 'confirm',
                name: 'upgrade',
                message: 'Do you want to upgrade all outdated Winget packages?',
                default: true
            }]);
            confirm = response.upgrade;
        }

        if (confirm) {
            console.log(chalk.yellow('  Upgrading all packages...'));
            await runCommand('winget', ['upgrade', '--all', '--accept-source-agreements', '--accept-package-agreements'], { stream: true });
            return { message: 'Upgrade complete.' };
        }
        return { message: 'Upgrade skipped.' };
    });
}

async function runChocoUpdates() {
    return runTask('Updating Chocolatey Software', async () => {
        try {
            await runCommand('choco', ['--version']);
        } catch (error) {
            throw new Error('Chocolatey is not installed or not in your PATH.');
        }

        const { stdout } = await runCommand('choco', ['outdated']);
        console.log(chalk.gray('\n' + stdout.trim()));

        if (stdout.includes('Chocolatey has determined 0 package(s) are outdated')) {
            return { message: 'All Chocolatey packages are up to date.' };
        }

        let confirm = argv.yes;
        if (!confirm && !argv.silent) {
            const response = await inquirer.prompt([{
                type: 'confirm',
                name: 'upgrade',
                message: 'Do you want to upgrade all outdated Chocolatey packages?',
                default: true
            }]);
            confirm = response.upgrade;
        }

        if (confirm) {
            await runCommand('choco', ['upgrade', 'all', '-y'], { stream: true });
            return { message: 'Upgrade complete.' };
        }
        return { message: 'Upgrade skipped.' };
    });
}

async function runDismCheck() {
    return runTask('Checking DISM Health', async () => {
        await runCommand('Dism.exe', ['/Online', '/Cleanup-Image', '/CheckHealth'], { stream: true });
    });
}

async function runSfcScan() {
    return runTask('Running System File Checker (sfc /scannow)', async () => {
        try {
            await runCommand('sfc', ['/scannow'], { stream: true });
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
        await runCommand('powershell.exe', ['-Command', 'Optimize-Volume -DriveLetter C'], { stream: true });
    });
}

async function runDnsFlush() {
    return runTask('Flushing DNS Cache', async () => {
        await runCommand('ipconfig', ['/flushdns'], { stream: true });
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
            $gpus = Get-CimInstance -ClassName Win32_VideoController
            $gpuList = @()
            foreach ($gpu in $gpus) {
                $vramMB = [int64]($gpu.AdapterRAM / 1MB)
                
                # WMI AdapterRAM is often capped at 4GB (4095/4096MB). 
                # If it's an NVIDIA card, nvidia-smi is much more reliable.
                if ($gpu.Name -like "*NVIDIA*") {
                    $nvsmiPaths = @(
                        "nvidia-smi.exe",
                        "$env:ProgramFiles\NVIDIA Corporation\NVSMI\nvidia-smi.exe",
                        "$env:SystemRoot\System32\nvidia-smi.exe"
                    )
                    foreach ($path in $nvsmiPaths) {
                        try {
                            $nvOutput = & $path --query-gpu=memory.total --format=csv,noheader,nounits 2>$null
                            if ($LASTEXITCODE -eq 0 -and $nvOutput) {
                                $memValues = $nvOutput -split "\\r?\\n" | Where-Object { $_ -match "\\d+" } | ForEach-Object { [int64]($_ -replace "[^\\d]","") }
                                if ($memValues.Count -gt 0) {
                                    $vramMB = ($memValues | Measure-Object -Maximum).Maximum
                                    break
                                }
                            }
                        } catch {}
                    }
                }
                
                $gpuList += @{
                    Name = $gpu.Name
                    AdapterRAM = $vramMB
                }
            }

            # Return the GPU with the most VRAM (likely the dedicated one)
            $gpuInfo = $gpuList | Sort-Object AdapterRAM -Descending | Select-Object -First 1
            if ($null -eq $gpuInfo) { $gpuInfo = @{ Name = "Unknown GPU"; AdapterRAM = 0 } }

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
            const vramFormatted = systemInfo.GPU.AdapterRAM >= 1024 
                ? `${(systemInfo.GPU.AdapterRAM / 1024).toFixed(1)} GB` 
                : `${systemInfo.GPU.AdapterRAM} MB`;
            output += chalk.bold('GPU:') + `\n  - ${systemInfo.GPU.Name}\n    - VRAM: ${vramFormatted}\n`;
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
    if (os.platform() !== 'win32') {
        console.error(chalk.red('ERROR: This tool is designed for Windows system maintenance only.'));
        process.exit(1);
    }

    console.log(chalk.bold.cyan('=== Windows System Maintenance Tool (Node.js) ===\n'));
    await writeLog('Script started.');

    await checkAdmin();

    const tasks = {
        hwInfo: { name: 'Gather Hardware & OS Information', task: runHardwareCheck, checked: true },
        winUpdate: { name: 'Check & Install Windows Updates', task: runWindowsUpdates, checked: true },
        winget: { name: 'Update Winget Software', task: runWingetUpdates, checked: true },
        choco: { name: 'Update Chocolatey Software', task: runChocoUpdates, checked: true },
        dism: { name: 'Check DISM Health', task: runDismCheck, checked: true },
        sfc: { name: 'Run System File Checker (SFC)', task: runSfcScan, checked: true },
        cleanup: { name: 'Clean Temporary Files', task: runTempFileCleanup, checked: true },
        dns: { name: 'Flush DNS Cache', task: runDnsFlush, checked: true },
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
