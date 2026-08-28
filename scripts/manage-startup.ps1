# manage-startup.ps1
param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall")]
    [string]$Action
)

$TaskName = "WinsloprMaintenance"
$LegacyTaskNames = @("SystemCheckMaintenance")

if ($Action -eq "install") {
    # Remove any legacy scheduled tasks to prevent duplicate triggers on startup
    foreach ($legacyName in $LegacyTaskNames) {
        $legacyTask = Get-ScheduledTask -TaskName $legacyName -ErrorAction SilentlyContinue
        if ($legacyTask) {
            Unregister-ScheduledTask -TaskName $legacyName -Confirm:$false
            Write-Host "Removed legacy startup task: $legacyName" -ForegroundColor Yellow
        }
    }

    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodePath) {
        if (Test-Path "C:\Program Files\nodejs\node.exe") {
            $nodePath = "C:\Program Files\nodejs\node.exe"
        } else {
            Write-Error "Node.js not found in PATH or standard installation directory. Please install Node.js."
            exit 1
        }
    }

    # Resolve the absolute path to index.js (assumed to be one level up from this script)
    $scriptPath = Resolve-Path "$PSScriptRoot\..\index.js"
    $scriptDir = Split-Path -Parent $scriptPath.Path
    
    # Create the action (runs node directly with index.js, passing silent and yes flags, with working directory set)
    $actionObj = New-ScheduledTaskAction -Execute "$nodePath" -Argument "`"$($scriptPath.Path)`" --silent --yes" -WorkingDirectory "$scriptDir"
    
    # Run with Highest Privileges (Administrator) under the current user context
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

    # Trigger on Logon for current user
    $triggerObj = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    
    $principalObj = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
    
    # Register the task
    Register-ScheduledTask -TaskName $TaskName -Action $actionObj -Trigger $triggerObj -Principal $principalObj -Force
    Write-Host "Successfully registered startup task: $TaskName" -ForegroundColor Green
    Write-Host "The tool will now run silently with Administrator privileges every time you log in."
}
else {
    $allTasks = @($TaskName) + $LegacyTaskNames
    $removedAny = $false
    foreach ($task in $allTasks) {
        $existingTask = Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $task -Confirm:$false
            Write-Host "Successfully removed startup task: $task" -ForegroundColor Yellow
            $removedAny = $true
        }
    }
    if (-not $removedAny) {
        Write-Host "No startup task named '$TaskName' found." -ForegroundColor Gray
    }
}

