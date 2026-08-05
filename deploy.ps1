# HK Deploy Script - Build and deploy to network share
param()

$ProjectDir  = $PSScriptRoot
$PublishDir  = "$ProjectDir\hk_published"
$configJson  = Get-Content -Raw -Path (Join-Path $ProjectDir "server_config.json") | ConvertFrom-Json
$NetworkApp  = $null
if (Test-Path $configJson.BasePath) {
    $NetworkApp = Get-ChildItem -Path $configJson.BasePath -Directory | Where-Object { $_.Name -like "1_*" } | Select-Object -First 1 -ExpandProperty FullName
}
$SkipFiles   = @("appsettings.json","server_config.json","hk.db","hk.db-wal","hk.db-shm","data.json")

Write-Host "=== HK DEPLOY ===" -ForegroundColor Cyan

# 1. Stop ALL HKServer instances
Write-Host "[1/4] Stopping server..." -ForegroundColor Yellow
Get-Process -Name "HKServer" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

# 2. Build
Write-Host "[2/4] Building (dotnet publish)..." -ForegroundColor Yellow
dotnet publish "$ProjectDir\HKServer.csproj" -c Release -o "$PublishDir" --nologo
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED!" -ForegroundColor Red; exit 1 }

# 3. Deploy to network (ignore locked files - they will update next restart)
if ($NetworkApp -and (Test-Path $NetworkApp)) {
    Write-Host "[3/4] Copying to network share..." -ForegroundColor Yellow
    Get-ChildItem "$PublishDir" -File | Where-Object { $SkipFiles -notcontains $_.Name } | ForEach-Object {
        Copy-Item $_.FullName -Destination (Join-Path $NetworkApp $_.Name) -Force -ErrorAction SilentlyContinue
    }
    robocopy "$PublishDir\wwwroot"  (Join-Path $NetworkApp "wwwroot")  /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    robocopy "$PublishDir\runtimes" (Join-Path $NetworkApp "runtimes") /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    Write-Host "      Network share updated" -ForegroundColor Green
} else {
    Write-Host "[3/4] Network share is not accessible. Skipping network copy." -ForegroundColor Yellow
}

# 4. Start server from local copy
Write-Host "[4/4] Starting server..." -ForegroundColor Yellow
Start-Process -FilePath "$PublishDir\HKServer.exe" -WorkingDirectory $PublishDir
Start-Sleep -Seconds 6
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:5001/api/ping" -UseBasicParsing -TimeoutSec 8 | Out-Null
    Write-Host "Server is UP at http://128.30.105.136:5001" -ForegroundColor Green
} catch {
    Write-Host "Server starting... check http://128.30.105.136:5001" -ForegroundColor Yellow
}
Write-Host "=== DONE ===" -ForegroundColor Cyan