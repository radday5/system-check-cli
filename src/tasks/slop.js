import { runPowerShell, runTask } from '../utils/helpers.js';

export async function runSlopRemoval() {
    return runTask('Removing Windows Slop (AI, Telemetry, Bing)', async () => {
        const script = `
            $registryPaths = @(
                @{ Path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot"; Name = "TurnOffWindowsCopilot"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot"; Name = "TurnOffWindowsCopilot"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows AI"; Name = "DisableAIDataAnalysis"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search"; Name = "BingSearchEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection"; Name = "AllowTelemetry"; Value = 0; Type = "DWord" }
            )

            foreach ($reg in $registryPaths) {
                if (-not (Test-Path $reg.Path)) {
                    New-Item -Path $reg.Path -Force | Out-Null
                }
                Set-ItemProperty -Path $reg.Path -Name $reg.Name -Value $reg.Value -Type $reg.Type -Force
                Write-Host "  Set $($reg.Name) to $($reg.Value) in $($reg.Path)"
            }
        `;
        await runPowerShell(script);
        return { message: 'AI features disabled and telemetry limited.' };
    });
}
