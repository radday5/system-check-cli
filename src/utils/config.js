import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { writeLog } from './helpers.js';

// Default tasks and their intervals
export const DEFAULT_TASKS_CONFIG = {
    slop: { name: 'Remove Windows Slop (AI, Telemetry, Bing)', checked: true, intervalDays: 0 },
    hwInfo: { name: 'Gather Hardware & OS Information', checked: true, intervalDays: 0 },
    winUpdate: { name: 'Check & Install Windows Updates', checked: true, intervalDays: 7 },
    winget: { name: 'Update Winget Software', checked: true, intervalDays: 3 },
    choco: { name: 'Update Chocolatey Software', checked: true, intervalDays: 3 },
    dism: { name: 'Check DISM Health', checked: true, intervalDays: 14 },
    sfc: { name: 'Run System File Checker (SFC)', checked: true, intervalDays: 14 },
    cleanup: { name: 'Clean Temporary Files', checked: true, intervalDays: 1 },
    recyclebin: { name: 'Empty Recycle Bin', checked: true, intervalDays: 1 },
    cuttingEdge: { name: 'Cutting-Edge Windows 11 Enhancements (HAGS, Sudo, Xbox Mode)', checked: true, intervalDays: 3 },
    diskcleanup: { name: 'Run Windows Disk Cleanup (Cleanmgr)', checked: false, intervalDays: 14 },
    wucleanup: { name: 'Clean Windows Update Download Cache', checked: true, intervalDays: 14 },
    dns: { name: 'Flush DNS Cache', checked: true, intervalDays: 0 },
    network: { name: 'Repair Network Stack & Reset Adapters', checked: true, intervalDays: 7 },
    optimize: { name: 'Optimize All Fixed Drives (Trim/Defrag)', checked: false, intervalDays: 14 }
};

export async function loadConfig(customPath) {
    let loadedConfig = {};

    if (customPath) {
        try {
            const data = await fs.readFile(customPath, 'utf8');
            loadedConfig = JSON.parse(data);
            await writeLog(`Loaded config from custom path: ${customPath}`);
            console.log(`Loaded custom configuration from: ${customPath}`);
        } catch (err) {
            console.error(`ERROR: Failed to load configuration from ${customPath}: ${err.message}`);
            process.exit(1);
        }
    } else {
        const configFilenames = ['winslopr.config.json', '.winsloprrc.json', '.winsloprrc'];
        const searchPaths = [
            process.cwd(),
            os.homedir()
        ];

        for (const searchPath of searchPaths) {
            for (const filename of configFilenames) {
                const fullPath = path.join(searchPath, filename);
                try {
                    const data = await fs.readFile(fullPath, 'utf8');
                    loadedConfig = JSON.parse(data);
                    await writeLog(`Loaded config from ${fullPath}`);
                    console.log(`Loaded custom configuration from: ${fullPath}`);
                    break;
                } catch (err) {
                    // Ignore and proceed to check other files
                }
            }
            if (Object.keys(loadedConfig).length > 0) {
                break;
            }
        }
    }

    // Merge default and loaded configuration
    const finalConfig = {};
    for (const [key, value] of Object.entries(DEFAULT_TASKS_CONFIG)) {
        finalConfig[key] = {
            name: value.name,
            checked: value.checked,
            intervalDays: value.intervalDays
        };

        if (loadedConfig.tasks && typeof loadedConfig.tasks[key] === 'boolean') {
            finalConfig[key].checked = loadedConfig.tasks[key];
        }
        if (loadedConfig.intervals && typeof loadedConfig.intervals[key] === 'number') {
            finalConfig[key].intervalDays = loadedConfig.intervals[key];
        }
    }

    return finalConfig;
}
