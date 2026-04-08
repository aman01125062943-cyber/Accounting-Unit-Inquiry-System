# Install-HKSystem.ps1
# This script installs the HK Returns System and creates shortcuts with the custom icon.

$InstallDir = "C:\HK_Returns_System"
$SourceDir = Get-Location
$ExePath = Join-Path $InstallDir "HKServer.exe"
$IconPath = Join-Path $InstallDir "app_icon.ico"
$ShortcutName = "HK_Returns_System"

Write-Host "--- Installing HK Returns System ---" -ForegroundColor Cyan

# 1. Create directory
if (!(Test-Path $InstallDir)) {
    New-Item -Path $InstallDir -ItemType Directory | Out-Null
}

# 2. Copy files (Smart detection of source)
if (Test-Path (Join-Path $SourceDir "HKServer.exe")) {
    Write-Host "Copying files from current directory..."
    Copy-Item -Path "$SourceDir\*" -Exclude ".git", ".agent", "bin", "obj", "hk_published" -Destination $InstallDir -Recurse -Force
} elseif (Test-Path (Join-Path $SourceDir "hk_published\HKServer.exe")) {
    Write-Host "Copying files from hk_published subfolder..."
    Copy-Item -Path "$SourceDir\hk_published\*" -Destination $InstallDir -Recurse -Force
} else {
    Write-Error "Could not find HKServer.exe in current directory or subfolders."
    exit 1
}

# 3. Create Shortcut on Desktop
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath("Desktop")
$ShortcutFile = Join-Path $DesktopPath "$ShortcutName.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutFile)
$Shortcut.TargetPath = $ExePath
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.Description = "HK Returns System Management"
$Shortcut.Save()

# 4. Create Shortcut in Start Menu
$StartMenuPath = [System.Environment]::GetFolderPath("StartMenu")
$ProgramsPath = Join-Path $StartMenuPath "Programs"
$StartShortcutFile = Join-Path $ProgramsPath "$ShortcutName.lnk"
$StartShortcut = $WshShell.CreateShortcut($StartShortcutFile)
$StartShortcut.TargetPath = $ExePath
$StartShortcut.WorkingDirectory = $InstallDir
$StartShortcut.IconLocation = "$IconPath,0"
$StartShortcut.Save()

Write-Host "--- SUCCESS ---" -ForegroundColor Green
Write-Host "System installed to: $InstallDir"
Write-Host "Icon created on your Desktop."
