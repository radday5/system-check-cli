import chalk from 'chalk';
import inquirer from 'inquirer';
import { runPowerShell, runCommand, runTask } from '../utils/helpers.js';

export async function runWindowsUpdates(argv) {
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

export async function runWingetUpdates(argv) {
    return runTask('Updating Winget Software', async () => {
        try {
            await runCommand('winget', ['--version']);
        } catch (error) {
            await writeLog('Winget is not installed or not in PATH. Skipping Winget updates.', 'INFO');
            return { message: 'Winget is not installed (skipped).' };
        }

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
                await runCommand('winget', ['upgrade', '--all', '--accept-source-agreements', '--accept-package-agreements'], { stream: true });
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

export async function runChocoUpdates(argv) {
    return runTask('Updating Chocolatey Software', async () => {
        try {
            await runCommand('choco', ['--version']);
        } catch (error) {
            await writeLog('Chocolatey is not installed or not in PATH. Skipping Chocolatey updates.', 'INFO');
            return { message: 'Chocolatey is not installed (skipped).' };
        }

        let stdout = '';
        try {
            const result = await runCommand('choco', ['outdated']);
            stdout = result.stdout;
        } catch (error) {
            // choco outdated returns exit code 2 when there are outdated packages.
            if (error.code === 2 && error.stdout) {
                stdout = error.stdout;
            } else {
                throw error;
            }
        }

        console.log(chalk.gray('\n' + stdout.trim()));

        if (stdout.includes('Chocolatey has determined 0 package(s) are outdated') || stdout.trim() === '') {
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
