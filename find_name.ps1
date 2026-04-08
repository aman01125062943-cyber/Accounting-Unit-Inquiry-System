
try {
    Add-Type -Path "c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll"
} catch {
    Add-Type -Path "c:\Users\esth633\Desktop\hk\bin\Release\net8.0\Microsoft.Data.Sqlite.dll"
}

$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, RawData FROM SalaryReturns ORDER BY Id DESC LIMIT 20"
$reader = $cmd.ExecuteReader()
while($reader.Read()) {
    Write-Host "ID: $($reader.GetInt32(0))"
    Write-Host $reader.GetString(1)
}
$conn.Close()
