import { runPowerShell, runTask } from '../utils/helpers.js';

export async function runSlopRemoval() {
    return runTask('Removing Windows Slop (AI, Telemetry, Bing)', async () => {
        const script = `
            $registryPaths = @(
                # Copilot and AI Features (including Windows Recall & Copilot Hardware Key)
                @{ Path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot"; Name = "TurnOffWindowsCopilot"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot"; Name = "TurnOffWindowsCopilot"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows AI"; Name = "DisableAIDataAnalysis"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Windows AI"; Name = "DisableAIDataAnalysis"; Value = 1; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Recall"; Name = "DisableRecall"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Recall"; Name = "DisableRecall"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "ShowCopilotButton"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "CopilotEnabled"; Value = 0; Type = "DWord" },
                
                # Start Menu Web Search, Bing, & Recommendations / Account Badging
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search"; Name = "BingSearchEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer"; Name = "DisableSearchBoxSuggestions"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search"; Name = "CortanaConsent"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings"; Name = "IsDynamicSearchBoxEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search"; Name = "EnableSearchHighlights"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "Start_AccountNotifications"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "ShowRecommendations"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "Start_IrisRecommendations"; Value = 0; Type = "DWord" },
                
                # Telemetry & Diagnostic Data
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection"; Name = "AllowTelemetry"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy"; Name = "TailoredExperiencesWithDiagnosticDataEnabled"; Value = 0; Type = "DWord" },
                
                # Cloud Bloatware & Spotlight / Lockscreen / Settings Recommendations
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent"; Name = "DisableWindowsConsumerFeatures"; Value = 1; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SilentInstalledAppsEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SystemPaneSuggestionsEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SoftLandingEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "RotatingLockScreenEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "RotatingLockScreenOverlayEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-338393Enabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-353694Enabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-353696Enabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\UserProfileEngagement"; Name = "ScoobeSystemSettingEnabled"; Value = 0; Type = "DWord" },
                
                # File Explorer Promotions / Sync Notifications
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "ShowSyncProviderNotifications"; Value = 0; Type = "DWord" },

                # Microsoft Edge Slop (Copilot Sidebar, Shopping, Telemetry)
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"; Name = "HubsSidebarEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"; Name = "ShowAIFeatures"; Value = 0; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"; Name = "EdgeShoppingAssistantEnabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"; Name = "PersonalizationReportingEnabled"; Value = 0; Type = "DWord" },

                # Game DVR / Background Capture Overhead
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR"; Name = "AllowGameDVR"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\System\\GameConfigStore"; Name = "GameDVR_Enabled"; Value = 0; Type = "DWord" },

                # Advertising ID
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo"; Name = "Enabled"; Value = 0; Type = "DWord" },
                
                # Feedback & Diagnostics
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection"; Name = "DoNotShowFeedbackNotifications"; Value = 1; Type = "DWord" },
                
                # News & Interests (Widgets) & Taskbar Slop (Widgets, Chat/Meet icons)
                @{ Path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh"; Name = "AllowNewsAndInterests"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "TaskbarDa"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"; Name = "TaskbarMn"; Value = 0; Type = "DWord" },
                
                # Windows Spotlight & Suggestions
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-338387Enabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-338388Enabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-338389Enabled"; Value = 0; Type = "DWord" },
                @{ Path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"; Name = "SubscribedContent-353636Enabled"; Value = 0; Type = "DWord" }
            )

            foreach ($reg in $registryPaths) {
                if (-not (Test-Path $reg.Path)) {
                    New-Item -Path $reg.Path -Force | Out-Null
                }
                Set-ItemProperty -Path $reg.Path -Name $reg.Name -Value $reg.Value -Type $reg.Type -Force
                Write-Host "  Set $($reg.Name) to $($reg.Value) in $($reg.Path)"
            }

            # Disable Connected User Experiences & Telemetry Services
            $telemetryServices = @("DiagTrack", "dmwappushservice")
            foreach ($svc in $telemetryServices) {
                $service = Get-Service -Name $svc -ErrorAction SilentlyContinue
                if ($service) {
                    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
                    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
                    Write-Host "  Disabled Telemetry Service: $svc"
                }
            }
        `;
        await runPowerShell(script);
        return { message: 'AI, Bing search, diagnostic telemetry, Edge/Explorer ads, lockscreen promos, and telemetry services disabled.' };
    });
}

