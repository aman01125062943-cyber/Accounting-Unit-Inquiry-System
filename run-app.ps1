$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$url = "http://localhost:5001"

Write-Host "Starting app from: $projectRoot"
Write-Host "URL: $url"

dotnet run --project HKServer.csproj --urls $url
