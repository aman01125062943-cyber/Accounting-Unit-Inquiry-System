
[Reflection.Assembly]::LoadFrom("c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll")
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    
    Write-Host "--- Schema for 'Returns' ---"
    $cmd.CommandText = "PRAGMA table_info(Returns)"
    $reader = $cmd.ExecuteReader()
    while($reader.Read()) {
        Write-Host "$($reader['name']) ($($reader['type']))"
    }
    $reader.Close()

    Write-Host "`n--- Schema for 'SalaryReturns' ---"
    $cmd.CommandText = "PRAGMA table_info(SalaryReturns)"
    $reader = $cmd.ExecuteReader()
    while($reader.Read()) {
        Write-Host "$($reader['name']) ($($reader['type']))"
    }
    $reader.Close()
}
finally {
    $conn.Close()
}
