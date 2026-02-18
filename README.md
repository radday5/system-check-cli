# Windows System Maintenance CLI

A command-line interface (CLI) tool built with Node.js to perform essential Windows system maintenance tasks. This tool aims to automate common checks and updates, inspired by robust PowerShell scripts, providing a modern, cross-platform-friendly way to keep your Windows system healthy.

## ✨ Features

-   **Administrator Check**: Ensures the tool runs with the necessary privileges.
-   **Winget Software Update**: Checks for and initiates updates for applications installed via Winget.
-   **DISM Health Check**: Runs `Dism.exe /Online /Cleanup-Image /CheckHealth` to check the Windows component store for corruption.
-   **System File Checker (SFC)**: Executes `sfc /scannow` to verify and repair protected Windows system files.
-   **Logging**: All actions and outputs are logged to a temporary file for review.

## 🚀 Quick Start (Recommended)

Run it instantly without installing it:

```bash
# Run with npx (ensure you are using an Administrator terminal)
npx system-check-cli
```

## 📦 Local Installation (Development)

If you'd like to clone and run it locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/radday5/system-check-cli.git
    cd system-check-cli
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run with npx**:
    ```bash
    npx .
    ```

**IMPORTANT**: You must run your terminal (PowerShell, Command Prompt, etc.) **as an Administrator** for the tool to function correctly. This tool is designed **specifically for Windows**.

### Silent Mode

You can run the tool in silent mode. In this mode, `winget` updates will attempt to install automatically without prompts.

```bash
# From within the 'system-check-cli' directory
npx . --silent
```

### Log File

A log file is created in your system's temporary directory (`%TEMP%` on Windows) for each run. The path to this log file will be displayed at the end of the execution.

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, bug fixes, or improvements, please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the ISC License. See the `LICENSE` file (to be added) for details.
