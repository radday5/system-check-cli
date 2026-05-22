import chalk from 'chalk';
import inquirer from 'inquirer';
import { runPowerShell, runTask } from '../utils/helpers.js';

export async function runCuttingEdgeEnhancements(argv) {
    return runTask('Checking Cutting-Edge Windows Features', async () => {
        const script = `
            $results = @()

            # 1. Check Hardware-Accelerated GPU Scheduling (HAGS)
            $hags = Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "HwSchMode" -ErrorAction SilentlyContinue
            $hagsStatus = if ($hags -and $hags.HwSchMode -eq 2) { "Enabled" } else { "Disabled" }
            $results += @{ Name = "Hardware-Accelerated GPU Scheduling (HAGS)"; Status = $hagsStatus; Registry = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"; ValueName = "HwSchMode"; TargetValue = 2 }

            # 2. Check Sudo for Windows
            $sudo = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Sudo" -Name "Enabled" -ErrorAction SilentlyContinue
            $sudoStatus = if ($sudo -and $sudo.Enabled -eq 1) { "Enabled" } else { "Disabled" }
            $results += @{ Name = "Sudo for Windows"; Status = $sudoStatus; Registry = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Sudo"; ValueName = "Enabled"; TargetValue = 1 }

            # 3. Check Game Mode (Xbox Mode)
            $gameMode = Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AutoGameModeEnabled" -ErrorAction SilentlyContinue
            $gmStatus = if ($gameMode -and $gameMode.AutoGameModeEnabled -eq 1) { "Enabled" } else { "Disabled" }
            $results += @{ Name = "Windows Game Mode (Performance Prioritization)"; Status = $gmStatus; Registry = "HKCU:\\Software\\Microsoft\\GameBar"; ValueName = "AutoGameModeEnabled"; TargetValue = 1 }

            # 4. Check DirectStorage Support (BypassIO)
            $dsStatus = "Not Supported"
            try {
                $sysDrive = $env:SystemDrive
                if (-not $sysDrive) { $sysDrive = "C:" }
                $fsutilOut = fsutil bypassio state $sysDrive 2>$null
                $fsutilString = $fsutilOut -join " "
                if ($fsutilString -match "currently supported" -or $fsutilString -match "is supported" -or $fsutilString -match "BypassIo compatible") {
                    $dsStatus = "Supported"
                } elseif ($fsutilString -match "not supported") {
                    $dsStatus = "Not Supported"
                } else {
                    $dsStatus = "Unknown"
                }
            } catch {
                $dsStatus = "Unknown"
            }
            $results += @{ Name = "DirectStorage (GPU-Accelerated Loading)"; Status = $dsStatus }

            # 5. Check Virtualization-Based Security (VBS)
            $vbsStatus = "Disabled"
            try {
                $vbs = Get-CimInstance -Namespace root/Microsoft/Windows/DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction SilentlyContinue
                if ($vbs -and $vbs.VirtualizationBasedSecurityStatus -eq 2) {
                    $vbsStatus = "Enabled"
                }
            } catch {}
            $results += @{ Name = "Virtualization-Based Security (VBS / Core Isolation)"; Status = $vbsStatus }


            $results | ConvertTo-Json -Compress
        `;

        const { stdout } = await runPowerShell(script);
        const features = JSON.parse(stdout);

        console.log(chalk.bold.cyan('\n--- Cutting Edge Feature Status ---\n'));
        features.forEach(f => {
            const statusColor = f.Status === 'Enabled' || f.Status === 'Supported' ? chalk.green : chalk.yellow;
            console.log(`${chalk.bold(f.Name)}: ${statusColor(f.Status)}`);
        });

        const toEnable = features.filter(f => f.Status === 'Disabled');

        if (toEnable.length > 0) {
            let confirm = argv.yes;
            if (!confirm && !argv.silent) {
                const response = await inquirer.prompt([{
                    type: 'checkbox',
                    name: 'selected',
                    message: 'Select features you would like to enable for better performance:',
                    choices: toEnable.map(f => ({ name: f.Name, value: f, checked: true }))
                }]);
                confirm = response.selected;
            } else if (argv.yes) {
                confirm = toEnable;
            }

            if (confirm && confirm.length > 0) {
                console.log(chalk.yellow('\n  Enabling selected features...'));
                for (const f of confirm) {
                    if (f.Registry) {
                        const enableScript = `
                            if (-not (Test-Path "${f.Registry}")) {
                                New-Item -Path "${f.Registry}" -Force | Out-Null
                            }
                            Set-ItemProperty -Path "${f.Registry}" -Name "${f.ValueName}" -Value ${f.TargetValue} -Type DWord -Force
                        `;
                        await runPowerShell(enableScript);
                        console.log(chalk.green(`    [OK] ${f.Name} enabled.`));
                    }
                }
                return { message: 'Cutting-edge optimizations applied. A reboot may be required.' };
            }
        }

        return { message: 'All cutting-edge features checked.' };
    });
}
