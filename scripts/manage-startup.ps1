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
        Write-Error "Node.js not found in PATH. Please install Node.js."
        exit 1
    }

    # Resolve the absolute path to index.js (assumed to be one level up from this script)
    $scriptPath = Resolve-Path "$PSScriptRoot\..\index.js"
    
    # Create the action (runs node with the script and silent flags via powershell to hide the window)
    $actionObj = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -Command `"& '$nodePath' '$($scriptPath.Path)' --silent --yes`""
    
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
