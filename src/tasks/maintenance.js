import chalk from 'chalk';
import { runCommand, runPowerShell, runTask } from '../utils/helpers.js';

export async function runDismCheck() {
    return runTask('Checking DISM Health', async () => {
        await runCommand('Dism.exe', ['/Online', '/Cleanup-Image', '/CheckHealth'], { stream: true });
    });
}

export async function runSfcScan() {
    return runTask('Running System File Checker (sfc /scannow)', async () => {
        try {
            await runCommand('sfc', ['/scannow'], { stream: true });
        } catch (error) {
            if (error.message.includes('exit code 1')) {
                const systemRoot = process.env.SystemRoot || 'C:\\Windows';
                throw new Error(`sfc /scannow failed. This may indicate that Windows Resource Protection found integrity violations.\n  Please check the CBS.log for more details: ${systemRoot}\\Logs\\CBS\\CBS.log`);
            }
            throw error;
        }
    });
}

export async function runDiskOptimization() {
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
