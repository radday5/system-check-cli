# Winslopr (Windows Slop Remover)

A powerful, interactive command-line tool built with Node.js to automate the removal of "Windows Slop" (bloatware, AI features, telemetry), perform system maintenance, and keep your software updated.

## ✨ Features

-   **⚡ Smart-Throttling (Startup Optimization)**: Automatically limits heavy or disruptive tasks (like SFC scans, DISM health checks, full disk defrags, system/package updates, and network adapter resets) to run only at sensible intervals (e.g. 7 or 14 days) during silent startup runs, ensuring your computer boots in **under 5 seconds** instead of hogging resources for 30+ minutes on every login.
-   **🧹 Slop Removal**: Disables AI features like **Copilot** and **Recall**, removes Bing search from Start, and limits telemetry.
-   **🛡️ Administrator Check**: Automatically verifies for required elevated privileges.
-   **🖥️ Hardware & OS Info**: Provides a detailed summary of your CPU, GPU (with VRAM), RAM, Motherboard, Windows version, and all fixed drives.
-   **🔄 Windows Updates**: Scans for, lists, and **installs** pending Windows Updates.
-   **📦 Software Updates**: 
    -   **Winget**: Refreshes sources and upgrades all outdated packages.
    -   **Chocolatey**: Checks for and upgrades all outdated packages.
-   **🛠️ System Health**:
    -   **DISM**: Repairs the Windows Component Store health.
    -   **SFC**: Runs System File Checker (`sfc /scannow`) to repair corrupted system files.
-   **🧹 System Cleanup**:
    -   **Temp Files**: Safely clears Windows and User temporary folders (skipping sensitive app folders).
    -   **Recycle Bin**: Empties the Recycle Bin for all users.
    -   **Disk Cleanup**: Runs Windows Disk Cleanup silently via PowerShell (cleans logs, cache, error reports).
    -   **DNS Cache**: Flushes the DNS resolver cache (`ipconfig /flushdns`).
    -   **Drive Optimization**: Runs `defrag /O` (Trim/Defrag) on all fixed logical drives.
-   **🌐 Network Repair**: Resets Winsock/IP stack and applies stability fixes for common 2.5GbE adapters (Intel/Realtek).
-   **📜 Real-time Logging**: Streams all command output directly to the console and saves a detailed execution log to your `%TEMP%` folder.

---

## 🚀 How to Run

### ⚡ Quick Start (No Install)
The easiest way to run the tool is via `npx`. **Make sure to open your terminal (PowerShell or CMD) as an Administrator.**

```bash
npx winslopr
```

### 🛠️ Local Installation (Development)
1. **Clone the repository**:
   ```bash
   git clone https://github.com/builtbybel/Winslopr.git
   cd Winslopr
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the tool**:
   ```bash
   node index.js
   ```

---

## ⚙️ CLI Options & "Yes to All"

You can customize how the tool runs using flags:

| Flag | Alias | Description |
| :--- | :--- | :--- |
| `--yes` | `-y` | **"Yes to All" mode.** Automatically accepts all update/install prompts. |
| `--silent` | `-s` | **Non-interactive mode.** Skips the initial task selection menu, runs default checked tasks, and automatically applies **Smart-Throttling**. |
| `--force` | `-f` | **Force mode.** Bypasses the Smart-Throttle intervals in silent mode and forces all selected tasks to run. |
| `--no-throttle` | | **Disable throttling.** Disables the last-run check entirely for the session. |
| `--info` | `-i` | **System Info mode.** Displays hardware and OS information and then exits. |
| `--tasks` | `-t` | **Specific tasks.** Run only selected tasks (e.g., `-t dns slop`). |
| `--config` | `-c` | **Custom Configuration.** Path to a custom configuration JSON file. |

## ⚙️ Custom Configuration File

Winslopr supports loading custom configuration files (named `winslopr.config.json`, `.winsloprrc.json`, or `.winsloprrc`) to change default task execution statuses and throttling intervals.

Winslopr automatically searches for these files in:
1. The **current working directory** where you run the tool.
2. The **user home directory** (`%USERPROFILE%`).

Alternatively, you can specify a custom path using the `--config` (or `-c`) flag:
```bash
npx winslopr -c "C:\path\to\custom-config.json"
```

### Configuration Format

Create a JSON file with the following structure. You can customize the `tasks` (enabled by default in interactive/silent mode) and `intervals` (throttle days):

```json
{
  "tasks": {
    "slop": true,
    "hwInfo": true,
    "winUpdate": false,
    "winget": true,
    "choco": false,
    "dism": false,
    "sfc": false,
    "cleanup": true,
    "recyclebin": true,
    "cuttingEdge": true,
    "diskcleanup": false,
    "wucleanup": true,
    "dns": true,
    "network": false,
    "optimize": false
  },
  "intervals": {
    "cleanup": 2,
    "recyclebin": 2,
    "winget": 5,
    "choco": 5,
    "cuttingEdge": 5,
    "winUpdate": 14,
    "network": 14,
    "dism": 30,
    "sfc": 30,
    "diskcleanup": 30,
    "wucleanup": 30,
    "optimize": 30
  }
}
```

- **`tasks`**: Keys correspond to the task names. Set to `true` to enable by default, or `false` to disable.
- **`intervals`**: The number of days to wait before running the task again in silent/non-interactive mode.


### ⚡ Smart-Throttle Intervals

When running in non-interactive/silent mode (such as at Windows Startup), Winslopr uses a persistent state file (`%LOCALAPPDATA%\winslopr-state.json`) to track when tasks last completed successfully. It skips heavy or disruptive tasks if they ran recently:

| Task Key | Task Name | Runs At Most Once Every |
| :--- | :--- | :--- |
| `slop` | Remove Windows Slop | *Every run* (Instant) |
| `hwInfo` | Gather Hardware & OS Information | *Every run* (Instant) |
| `dns` | Flush DNS Cache | *Every run* (Instant) |
| `cleanup` | Clean Temporary Files | 1 day |
| `recyclebin` | Empty Recycle Bin | 1 day |
| `winget` | Update Winget Software | 3 days |
| `choco` | Update Chocolatey Software | 3 days |
| `cuttingEdge` | Windows 11 Enhancements | 3 days |
| `winUpdate` | Check & Install Windows Updates | 7 days |
| `network` | Repair Network Stack & Reset Adapters | 7 days (prevents daily network drops) |
| `dism` | Check DISM Health | 14 days |
| `sfc` | Run System File Checker (SFC) | 14 days (prevents daily 15-minute scans) |
| `diskcleanup` | Run Windows Disk Cleanup | 14 days |
| `wucleanup` | Clean Windows Update Cache | 14 days |
| `optimize` | Optimize All Fixed Drives (Trim/Defrag) | 14 days |

### 💡 Pro Examples:

**1. Fully Automated (The "Slop-Free" Mode):**
Run all default tasks and apply every fix without any clicking or typing:
```bash
npx winslopr -s -y
```

---

## ⏰ Automated Startup (Task Scheduler)

You can set up Winslopr to run silently in the background every time you log into Windows.

> **Note:** This requires **Administrator privileges**.

### ➕ Enable Startup
Run this command to create a scheduled task:
```bash
npm run startup:install
```

### ➖ Disable Startup
Run this command to remove the scheduled task:
```bash
npm run startup:uninstall
```

---

## 📋 Requirements
- **Operating System**: Windows 10 or 11.
- **Privileges**: **Administrator Rights**.
- **Environment**: Node.js 20.0.0 or higher.

## 📄 License
This project is licensed under the ISC License.
