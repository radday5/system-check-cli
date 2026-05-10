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
  .option('tasks', {
    alias: 't',
    type: 'array',
    description: 'Specify which tasks to run (e.g., -t network dns)',
  })
  .argv;

const toolTempDir = path.join(os.tmpdir(), 'SystemMaintenance-Scripts');
const logFile = path.join(toolTempDir, `SystemMaintenance-${new Date().toISOString().replace(/:/g, '-')}.log`);

// Ensure the tool's script directory exists
async function ensureTempDir() {
    try {
        await fs.mkdir(toolTempDir, { recursive: true });
    } catch (err) {
        // Ignore errors if directory exists
    }
}

async function writeLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}${os.EOL}`;
    try {
        await fs.appendFile(logFile, logEntry);
    } catch (err) {
        // Silently fail logging if file is inaccessible
    }
}

/**
 * Executes a PowerShell script by writing it to a temporary file and running it.
 * @param {string} script The PowerShell script content.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runPowerShell(script) {
    const scriptPath = path.join(toolTempDir, `ps-script-${Date.now()}-${Math.floor(Math.random() * 1000)}.ps1`);
    await fs.writeFile(scriptPath, script);
    try {
        return await runCommand('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);
    } finally {
        await fs.unlink(scriptPath).catch(err => writeLog(`Failed to delete temp script: ${err.message}`, 'DEBUG'));
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
    const startTime = Date.now();
    const spinner = ora(title).start();
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
        let foundUpdates = false;
        try {
            const { stdout } = await runPowerShell(checkScript);
            console.log(chalk.gray('\n' + stdout.trim()));
            foundUpdates = stdout.includes('Found');
            if (!foundUpdates) return { message: 'System is up to date.' };
        } catch (error) {
            throw new Error(`Failed to check for updates: ${error.message}`);
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
                try {
                    const { stdout } = await runPowerShell(installScript);
                    if (stdout.includes('REBOOT_REQUIRED')) {
                        console.log(chalk.bold.red('\n  *** REBOOT REQUIRED to complete updates ***'));
                    }
                    return { message: 'Installation attempt finished.' };
                } catch (error) {
                    throw new Error(`Failed to install updates: ${error.message}`);
                }
            } else {
                return { message: 'Updates skipped by user.' };
            }
        }
    });
}

async function runWingetUpdates() {
    return runTask('Updating Winget Software', async () => {
        try {
            await runCommand('winget', ['source', 'update']);
        } catch (error) {
            // Ignore internal errors on source update, as it often works anyway or fails transiently
            if (!error.message.includes('2316632108')) {
                throw error;
            }
        }
        
        let stdout = '';
        try {
            const result = await runCommand('winget', ['upgrade']);
            stdout = result.stdout;
        } catch (error) {
            // Error 2316632108 (0x8A150001) is often returned when no updates are found or an internal error occurs
            if (error.message.includes('2316632108')) {
                return { message: 'All Winget packages are up to date (or encountered internal error).' };
            }
            throw error;
        }

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
            try {
                await runCommand('winget', ['upgrade', '--all', '--accept-source-agreements', '--accept-package-agreements']);
            } catch (error) {
                if (error.message.includes('2316632108')) {
                    return { message: 'Upgrade complete with some internal errors (or already up to date).' };
                }
                throw error;
            }
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
            await runCommand('choco', ['upgrade', 'all', '-y']);
            return { message: 'Upgrade complete.' };
        }
        return { message: 'Upgrade skipped.' };
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
                const systemRoot = process.env.SystemRoot || 'C:\\Windows';
                throw new Error(`sfc /scannow failed. This may indicate that Windows Resource Protection found integrity violations.\n  Please check the CBS.log for more details: ${systemRoot}\\Logs\\CBS\\CBS.log`);
            }
            throw error;
        }
    });
}

async function runTempFileCleanup() {
    return runTask('Cleaning Temporary Files', async () => {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const tempPaths = [os.tmpdir(), path.join(systemRoot, 'Temp')];
        let deletedFiles = 0;
        let skippedFiles = 0;

        // Folders to skip (often causing crashes if touched while apps are running)
        const skipFolders = ['SystemMaintenance-Scripts', 'EasyAntiCheat', 'Ubisoft', 'TheDivision2', 'D3DSCache', 'ShaderCache'];

        for (const tempPath of tempPaths) {
            try {
                await writeLog(`Cleaning folder: ${tempPath}`);
                const files = await fs.readdir(tempPath);

                // Delete files in parallel for better performance
                await Promise.all(files.map(file => {
                    const filePath = path.join(tempPath, file);
                    
                    // Skip sensitive folders
                    if (skipFolders.some(skip => file.includes(skip))) {
                        skippedFiles++;
                        return Promise.resolve();
                    }

                    return fs.rm(filePath, { recursive: true, force: true }).then(() => {
                        deletedFiles++;
                    }).catch(err => {
                        skippedFiles++;
                        // Log busy files at a lower level (DEBUG) to avoid noise
                        const level = err.code === 'EBUSY' ? 'DEBUG' : 'WARN';
                        return writeLog(`Could not delete ${filePath}: ${err.message}`, level);
                    });
                }));
            } catch (err) {
                await writeLog(`Could not access temp path ${tempPath}: ${err.message}`, 'WARN');
            }
        }
        return { message: `Deleted ${deletedFiles} files, ${skippedFiles} skipped (in use or sensitive).` };
    });
}
async function runDiskOptimization() {
    return runTask('Optimizing All Fixed Drives (Trim/Defrag)', async () => {
        const script = `
            $drives = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3"
            foreach ($drive in $drives) {
                $letter = $drive.DeviceID
                Write-Host "Optimizing Drive $letter..."
                # defrag /O performs the proper optimization for the media type (Trim for SSD, Defrag for HDD)
                defrag.exe $letter /O /V
            }
        `;
        const { stdout } = await runPowerShell(script);
        console.log(chalk.gray('\n' + stdout.trim()));
    });
}

async function runDnsFlush() {
    return runTask('Flushing DNS Cache', async () => {
        await runCommand('ipconfig', ['/flushdns']);
    });
}

async function runNetworkRepair() {
    return runTask('Repairing Network Stack & Adapters', async () => {
        console.log(chalk.yellow('  Resetting Winsock and IP stack...'));
        try {
            await runCommand('netsh', ['winsock', 'reset']);
            await runCommand('netsh', ['int', 'ip', 'reset']);
            await runCommand('netsh', ['int', 'ipv6', 'reset']);
        } catch (error) {
            const msg = error.message.includes('Access is denied') 
                ? 'Network stack reset partially failed (Access denied on some keys). This is common and usually requires a reboot.' 
                : error.message;
            await writeLog(`Network stack reset issues: ${msg}`, 'DEBUG');
            console.log(chalk.gray(`  Note: ${msg}`));
        }

        console.log(chalk.yellow('  Flushing DNS and renewing IP...'));
        try {
            await runCommand('ipconfig', ['/flushdns']);
            await runCommand('ipconfig', ['/release']);
            await runCommand('ipconfig', ['/renew']);
        } catch (error) {
            await writeLog(`IP renewal had some issues: ${error.message}`, 'DEBUG');
        }

        // Stability fixes for Intel I225-V, Realtek 2.5GbE and other adapters known for link drops
        const stabilityFixScript = `
            $classGuid = "{4d36e972-e325-11ce-bfc1-08002be10318}"
            $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\$classGuid"
            $appliedCount = 0

            # Properties to disable for stability (EEE, ULP, Power Saving, Offloading issues)
            $propsToDisable = @(
                "*EEE", "AdvancedEEE", "EEEMaxSupportSpeed", "EnableGreenEthernet",
                "ULPMode", "PowerSavingMode", "PowerDownPll",
                "WaitAutoNegComplete", "*LsoV2IPv4", "*LsoV2IPv6", "*FlowControl"
            )

            # Properties to set to specific values (e.g., Flow Control, Interrupt Moderation)
            $propsToSet = @{
                "ITR" = "64"               # Set Interrupt Moderation to 'Low'
                "*InterruptModeration" = "1" # Ensure Interrupt Moderation is Enabled
            }

            $physicalAdapters = Get-NetAdapter -Physical
            foreach ($adapter in $physicalAdapters) {
                Get-ChildItem $regPath -ErrorAction SilentlyContinue | ForEach-Object {
                    $path = $_.Name.Replace("HKEY_LOCAL_MACHINE", "HKLM:")
                    $driverDesc = Get-ItemProperty -Path $path -Name "DriverDesc" -ErrorAction SilentlyContinue
                    if ($driverDesc -and $driverDesc.DriverDesc -eq $adapter.InterfaceDescription) {
                        Write-Host "  Checking: $($adapter.InterfaceDescription)"
                        $adapterApplied = $false

                        foreach ($prop in $propsToDisable) {
                            if (Get-ItemProperty -Path $path -Name $prop -ErrorAction SilentlyContinue) {
                                Set-ItemProperty -Path $path -Name $prop -Value "0"
                                Write-Host "    - Disabled $prop"
                                $adapterApplied = $true
                            }
                        }

                        foreach ($prop in $propsToSet.Keys) {
                            if (Get-ItemProperty -Path $path -Name $prop -ErrorAction SilentlyContinue) {
                                Set-ItemProperty -Path $path -Name $prop -Value $propsToSet[$prop]
                                Write-Host "    - Configured $prop"
                                $adapterApplied = $true
                            }
                        }
                        
                        if ($adapterApplied) { $appliedCount++ }
                    }
                }
            }
            if ($appliedCount -gt 0) { Write-Host "STABILITY_FIX_APPLIED" }
        `;

        let fixApplied = false;
        try {
            const { stdout } = await runPowerShell(stabilityFixScript);
            if (stdout.includes('STABILITY_FIX_APPLIED')) {
                fixApplied = true;
                console.log(chalk.green('  Applied network adapter stability fixes (EEE/ULP disabled, ITR optimized).'));
                console.log(chalk.gray(stdout.trim()));
                await writeLog('Applied network adapter stability fixes.', 'INFO');
            }
        } catch (error) {
            await writeLog(`Stability fix failed: ${error.message}`, 'DEBUG');
        }

        // Only suggest/perform restart if fixes were applied or if running manually
        let confirmRestart = false;
        if (argv.yes && !argv.silent) {
            confirmRestart = true;
        } else if (!argv.silent) {
            const response = await inquirer.prompt([{
                type: 'confirm',
                name: 'restart',
                message: 'Do you want to restart all physical network adapters to apply changes? (Briefly drops connection)',
                default: fixApplied // Default to true if we actually changed something
            }]);
            confirmRestart = response.restart;
        } else if (argv.yes && argv.silent && fixApplied) {
            // In fully automated mode, only restart if we actually applied a fix
            confirmRestart = true;
        }

        if (confirmRestart) {
            console.log(chalk.yellow('  Restarting physical adapters...'));
            const restartScript = `
                $adapters = Get-NetAdapter -Physical
                foreach ($adapter in $adapters) {
                    Write-Host "    Restarting $($adapter.Name)..."
                    Restart-NetAdapter -Name $adapter.Name -Confirm:$false
                }
            `;
            try {
                await runPowerShell(restartScript);
                await writeLog('Restarted all physical network adapters.', 'INFO');
            } catch (error) {
                throw new Error(`Failed to restart adapters: ${error.message}`);
            }
            return { message: 'Network stack reset, stability fixes applied, and adapters restarted.' };
        }

        return { message: 'Network stack reset and stability fixes applied (Restart may be required for full effect).' };
    });
}

async function runSlopRemoval() {
    return runTask('Removing Windows Slop (AI, Telemetry, Bing)', async () => {
        const script = `
            $registryPaths = @(
                @{ Path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot"; Name = "TurnOffWindowsCopilot"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot"; Name = "TurnOffWindowsCopilot"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows AI"; Name = "DisableAIDataAnalysis"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search"; Name = "BingSearchEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection"; Name = "AllowTelemetry"; Value = 0; Type = "DWord" }
            )

            foreach ($reg in $registryPaths) {
                if (-not (Test-Path $reg.Path)) {
                    New-Item -Path $reg.Path -Force | Out-Null
                }
                Set-ItemProperty -Path $reg.Path -Name $reg.Name -Value $reg.Value -Type $reg.Type -Force
                Write-Host "  Set $($reg.Name) to $($reg.Value) in $($reg.Path)"
            }
        `;
        await runPowerShell(script);
        return { message: 'AI features disabled and telemetry limited.' };
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

            # Get All Fixed Disk Information
            $disks = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3"
            $diskList = @()
            foreach ($disk in $disks) {
                $diskList += @{
                    DeviceID = $disk.DeviceID
                    Size = [math]::Round($disk.Size / 1GB)
                    FreeSpace = [math]::Round($disk.FreeSpace / 1GB)
                }
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
                Disks = $diskList
                Motherboard = $mbInfo
            }

            # Convert to JSON and write to output
            $systemInfo | ConvertTo-Json -Depth 5 -Compress
        `;
        
        const { stdout } = await runPowerShell(psScript);
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from PowerShell output.');
        }
        const systemInfo = JSON.parse(jsonMatch[0]);

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
        
        if (systemInfo.Disks && systemInfo.Disks.length > 0) {
            output += chalk.bold('Disks:') + '\n';
            systemInfo.Disks.forEach(disk => {
                const freePercent = ((disk.FreeSpace / disk.Size) * 100).toFixed(1);
                output += `  - Drive ${disk.DeviceID} Size: ${disk.Size} GB, Free: ${disk.FreeSpace} GB (${freePercent}%)\n`;
            });
        }
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
    await ensureTempDir();
    if (os.platform() !== 'win32') {
        console.error(chalk.red('ERROR: This tool is designed for Windows system maintenance only.'));
        process.exit(1);
    }

    console.log(chalk.bold.cyan('=== Winslopr: Windows Slop Remover & Maintenance Tool ===\n'));
    await writeLog('Winslopr started.');

    await checkAdmin();

    const tasks = {
        slop: { name: 'Remove Windows Slop (AI, Telemetry, Bing)', task: runSlopRemoval, checked: true },
        hwInfo: { name: 'Gather Hardware & OS Information', task: runHardwareCheck, checked: true },
        winUpdate: { name: 'Check & Install Windows Updates', task: runWindowsUpdates, checked: true },
        winget: { name: 'Update Winget Software', task: runWingetUpdates, checked: true },
        choco: { name: 'Update Chocolatey Software', task: runChocoUpdates, checked: true },
        dism: { name: 'Check DISM Health', task: runDismCheck, checked: true },
        sfc: { name: 'Run System File Checker (SFC)', task: runSfcScan, checked: true },
        cleanup: { name: 'Clean Temporary Files', task: runTempFileCleanup, checked: true },
        dns: { name: 'Flush DNS Cache', task: runDnsFlush, checked: true },
        network: { name: 'Repair Network Stack & Reset Adapters', task: runNetworkRepair, checked: true },
        optimize: { name: 'Optimize All Fixed Drives (Trim/Defrag)', task: runDiskOptimization, checked: false },
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
