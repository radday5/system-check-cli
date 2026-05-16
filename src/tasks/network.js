import chalk from 'chalk';
import inquirer from 'inquirer';
import { runCommand, runPowerShell, runTask, writeLog } from '../utils/helpers.js';

export async function runNetworkRepair(argv) {
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
