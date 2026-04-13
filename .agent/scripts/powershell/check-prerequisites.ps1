param(
    [switch]$Json,
    [switch]$RequireTasks,
    [switch]$IncludeTasks
)

$targetDir = Join-Path $PSScriptRoot "..\..\..\specs\001-smart-settlement"
$targetDir = [System.IO.Path]::GetFullPath($targetDir)

# التحقق من وجود الملفات الأساسية
$specExists = Test-Path (Join-Path $targetDir "spec.md")
$planExists = Test-Path (Join-Path $targetDir "plan.md")
$tasksExists = Test-Path (Join-Path $targetDir "tasks.md")

if (-not $specExists -or -not $planExists -or ($RequireTasks -and -not $tasksExists)) {
    Write-Error "Missing required markdown files in $targetDir"
    exit 1
}

$output = @{
    FEATURE_DIR = $targetDir
    AVAILABLE_DOCS = @("spec.md", "plan.md", "tasks.md")
}

if ($Json) {
    $output | ConvertTo-Json -Compress
} else {
    Write-Output "Prerequisites checked successfully. Target: $targetDir"
}
