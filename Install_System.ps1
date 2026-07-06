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
$ProjectPath = Join-Path $SourceDir "HKServer.csproj"
$PublishDir = Join-Path $SourceDir "hk_published"

if (Test-Path $ProjectPath) {
    Write-Host "Publishing a fresh installer package..." -ForegroundColor Cyan
    dotnet publish $ProjectPath -c Release -o $PublishDir
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Publish failed. HKServer.exe was not created."
        exit 1
    }
    $PackageDir = $PublishDir
} else {
    $CandidateDirs = @(
        $SourceDir,
        (Join-Path $SourceDir "hk_published"),
        (Join-Path $SourceDir "publish_portable_latest")
    )

    $PackageDir = $CandidateDirs |
        Where-Object { Test-Path (Join-Path $_ "HKServer.exe") } |
        Select-Object -First 1
}

if ($PackageDir) {
    Write-Host "Copying files from: $PackageDir"
    Copy-Item -Path "$PackageDir\*" -Destination $InstallDir -Recurse -Force -ErrorAction Stop
} else {
    Write-Error "Could not find or build HKServer.exe."
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
