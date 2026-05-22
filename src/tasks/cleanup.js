import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { runCommand, runPowerShell, runTask, writeLog } from '../utils/helpers.js';

export async function runTempFileCleanup() {
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

export async function runDnsFlush() {
    return runTask('Flushing DNS Cache', async () => {
        await runCommand('ipconfig', ['/flushdns']);
    });
}

export async function runRecycleBinCleanup() {
    return runTask('Emptying Recycle Bin', async () => {
        const script = 'Clear-RecycleBin -Confirm:$false -ErrorAction SilentlyContinue';
        await runPowerShell(script);
        return { message: 'Recycle Bin emptied.' };
    });
}

export async function runDiskCleanup() {
    return runTask('Running Windows Disk Cleanup (Cleanmgr)', async () => {
        // Run cleanmgr in background as it can take a long time and doesn't provide much console feedback
        // /sagerun:1 is a common trick, but requires prior setup. 
        // We'll just run it with /VERYLOWDISK which is non-interactive and cleans up a lot.
        await runCommand('cleanmgr.exe', ['/VERYLOWDISK']);
        return { message: 'Disk Cleanup started/finished.' };
    });
}

export async function runWindowsUpdateCacheCleanup() {
    return runTask('Cleaning Windows Update Download Cache', async () => {
        const script = `
            Write-Host "  Stopping Windows Update service..."
            Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
            
            $wuCachePath = "$env:SystemRoot\\SoftwareDistribution\\Download"
            if (Test-Path $wuCachePath) {
                Write-Host "  Purging files in $wuCachePath..."
                Remove-Item -Path "$wuCachePath\\*" -Recurse -Force -ErrorAction SilentlyContinue
                $remainingCount = (Get-ChildItem -Path $wuCachePath).Count
                if ($remainingCount -eq 0) {
                    Write-Host "SUCCESS_CLEANED"
                }
            } else {
                Write-Host "SUCCESS_NOT_FOUND"
            }

            Write-Host "  Restarting Windows Update service..."
            Start-Service -Name wuauserv -ErrorAction SilentlyContinue
        `;
        const { stdout } = await runPowerShell(script);
        if (stdout.includes('SUCCESS_CLEANED') || stdout.includes('SUCCESS_NOT_FOUND')) {
            return { message: 'Windows Update download cache successfully purged.' };
        } else {
            return { message: 'Cache purge attempted. Some files may still be in use by the system.' };
        }
    });
}

