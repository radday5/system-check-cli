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

                // Delete files in batches to prevent file handle exhaustion and high IO lag
                const chunkSize = 50;
                for (let i = 0; i < files.length; i += chunkSize) {
                    const chunk = files.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(file => {
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
                }
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
    return runTask('Running Windows Disk Cleanup (PowerShell)', async () => {
        const script = `
            # Purge Delivery Optimization download cache
            $doPath = "$env:SystemRoot\\SoftwareDistribution\\DeliveryOptimization\\Download"
            if (Test-Path $doPath) {
                Remove-Item -Path "$doPath\\*" -Recurse -Force -ErrorAction SilentlyContinue
            }

            # Purge Windows Error Reporting files
            $werPaths = @(
                "$env:ProgramData\\Microsoft\\Windows\\WER\\ReportQueue",
                "$env:ProgramData\\Microsoft\\Windows\\WER\\ReportArchive",
                "$env:LocalAppData\\Microsoft\\Windows\\WER\\ReportQueue",
                "$env:LocalAppData\\Microsoft\\Windows\\WER\\ReportArchive"
            )
            foreach ($path in $werPaths) {
                if (Test-Path $path) {
                    Remove-Item -Path "$path\\*" -Recurse -Force -ErrorAction SilentlyContinue
                }
            }

            # Purge DirectX Shader Cache
            $shaderPath = "$env:LocalAppData\\D3DSCache"
            if (Test-Path $shaderPath) {
                Remove-Item -Path "$shaderPath\\*" -Recurse -Force -ErrorAction SilentlyContinue
            }

            # Purge system logs
            $logsPath = "$env:SystemRoot\\Logs"
            if (Test-Path $logsPath) {
                Remove-Item -Path "$logsPath\\*" -Recurse -Force -ErrorAction SilentlyContinue
            }
        `;
        await runPowerShell(script);
        return { message: 'System caches, logs, and error reports purged.' };
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

