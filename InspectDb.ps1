$dllPath = Join-Path $PSScriptRoot "bin\Debug\net8.0\Microsoft.Data.Sqlite.dll"
Add-Type -Path $dllPath
$dbPath = Join-Path $PSScriptRoot "hk.db"
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=$dbPath")
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = 'SELECT COUNT(*) FROM Returns'
$total = $cmd.ExecuteScalar()

$cmd.CommandText = 'SELECT COUNT(*) FROM Returns WHERE IsDeleted = 0'
$notDeleted = $cmd.ExecuteScalar()

$cmd.CommandText = 'SELECT COUNT(*) FROM Returns WHERE IsArchived = 1'
$archived = $cmd.ExecuteScalar()

Write-Host "Returns Total: $total | IsDeleted=0: $notDeleted | IsArchived=1: $archived"

$cmd.CommandText = 'SELECT COUNT(*) FROM SalaryReturns'
$totalSal = $cmd.ExecuteScalar()

$cmd.CommandText = 'SELECT COUNT(*) FROM SalaryReturns WHERE IsDeleted = 0'
$notDeletedSal = $cmd.ExecuteScalar()

Write-Host "SalaryReturns Total: $totalSal | IsDeleted=0: $notDeletedSal"

$conn.Close()
