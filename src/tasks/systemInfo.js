import chalk from 'chalk';
import ora from 'ora';
import { runPowerShell, writeLog } from '../utils/helpers.js';

export async function runHardwareCheck() {
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
                # Check nvidia-smi for NVIDIA, or Registry for AMD/Intel/Others if capped.
                if ($gpu.Name -like "*NVIDIA*") {
                    $nvsmiPaths = @(
                        "nvidia-smi.exe",
                        "$env:ProgramFiles\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe",
                        "$env:SystemRoot\\System32\\nvidia-smi.exe"
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
                
                if ($vramMB -le 4096) {
                    try {
                        $regClass = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}"
                        Get-ChildItem $regClass -ErrorAction SilentlyContinue | ForEach-Object {
                            $memSize = Get-ItemProperty -Path $_.PsPath -Name "HardwareInformation.MemorySize" -ErrorAction SilentlyContinue
                            if ($memSize -and $memSize.'HardwareInformation.MemorySize') {
                                $bytes = [int64]$memSize.'HardwareInformation.MemorySize'
                                $mb = [int64]($bytes / 1MB)
                                if ($mb -gt $vramMB) { $vramMB = $mb }
                            }
                        }
                    } catch {}
                }
                
                $driverDate = "Unknown"
                if ($gpu.DriverDate) {
                    try {
                        $driverDate = $gpu.DriverDate.ToString("yyyy-MM-dd")
                    } catch {
                        $driverDate = $gpu.DriverDate.ToString()
                    }
                }

                $gpuList += @{
                    Name = $gpu.Name
                    AdapterRAM = $vramMB
                    DriverVersion = $gpu.DriverVersion
                    DriverDate = $driverDate
                }
            }

            # Return the GPU with the most VRAM (likely the dedicated one)
            $gpuInfo = $gpuList | Sort-Object AdapterRAM -Descending | Select-Object -First 1
            if ($null -eq $gpuInfo) { $gpuInfo = @{ Name = "Unknown GPU"; AdapterRAM = 0; DriverVersion = "Unknown"; DriverDate = "Unknown" } }

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
            output += chalk.bold('GPU:') + `\n  - ${systemInfo.GPU.Name}\n    - VRAM: ${vramFormatted}\n    - Driver: ${systemInfo.GPU.DriverVersion} (${systemInfo.GPU.DriverDate})\n`;
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
