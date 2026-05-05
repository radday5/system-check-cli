# Winslopr (Windows Slop Remover)

A powerful, interactive command-line tool built with Node.js to automate the removal of "Windows Slop" (bloatware, AI features, telemetry), perform system maintenance, and keep your software updated.

## ✨ Features

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
| `--silent` | `-s` | **Non-interactive mode.** Skips the initial task selection menu and runs default tasks. |

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
