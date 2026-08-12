# manage-startup.ps1
param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall")]
    [string]$Action
)

$TaskName = "WinsloprMaintenance"

if ($Action -eq "install") {
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
    
    # Trigger on Logon
    $triggerObj = New-ScheduledTaskTrigger -AtLogOn
    
    # Run with Highest Privileges (Administrator) under the current user context
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principalObj = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
    
    # Register the task
    Register-ScheduledTask -TaskName $TaskName -Action $actionObj -Trigger $triggerObj -Principal $principalObj -Force
    Write-Host "Successfully registered startup task: $TaskName" -ForegroundColor Green
    Write-Host "The tool will now run silently with Administrator privileges every time you log in."
}
else {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Successfully removed startup task: $TaskName" -ForegroundColor Yellow
    } else {
        Write-Host "No startup task named '$TaskName' found." -ForegroundColor Gray
    }
}

