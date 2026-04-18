# Windows System Maintenance CLI (Node.js)

A powerful, interactive command-line tool built with Node.js to automate essential Windows system maintenance, software updates, and health checks.

## ✨ Features

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
    -   **Temp Files**: Safely clears Windows and User temporary folders.
    -   **DNS Cache**: Flushes the DNS resolver cache (`ipconfig /flushdns`).
    -   **Drive Optimization**: Runs `defrag /O` (Trim/Defrag) on all fixed logical drives.
-   **📜 Real-time Logging**: Streams all command output directly to the console and saves a detailed execution log to your `%TEMP%` folder.

---

## 🚀 How to Run

### ⚡ Quick Start (No Install)
The easiest way to run the tool is via `npx`. **Make sure to open your terminal (PowerShell or CMD) as an Administrator.**

```bash
npx system-check-cli
```

### 🛠️ Local Installation (Development)
1. **Clone the repository**:
   ```bash
   git clone https://github.com/radday5/system-check-cli.git
   cd system-check-cli
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
| `--silent` | `-s` | **Non-interactive mode.** Skips the initial task selection menu and runs default tasks. |

### 💡 Pro Examples:

**1. Fully Automated (The "Maintenance Mode"):**
Run all default tasks and install every update without any clicking or typing:
```bash
npx system-check-cli -s -y
```

**2. Interactive with Auto-Install:**
Choose which categories to run, but if you choose "Updates", don't ask for permission to install them:
```bash
npx system-check-cli -y
```

---

## ⏰ Automated Startup (Task Scheduler)

You can set up this tool to run silently in the background every time you log into Windows. This is the recommended way to keep your system updated automatically.

> **Note:** This requires **Administrator privileges** to register the task.

### ➕ Enable Startup
Run this command to create a scheduled task that executes the tool with `--silent` and `--yes` flags at every logon:
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
- **Privileges**: **Administrator Rights** (Right-click Terminal -> Run as Administrator).
- **Environment**: Node.js 20.0.0 or higher.

## 📄 License
This project is licensed under the ISC License.
