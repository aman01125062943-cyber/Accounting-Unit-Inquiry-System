
try {
    # محاولة تحميل مكتبة SQLite
    Add-Type -Path "c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll"
} catch {
    $dll = Get-ChildItem -Path "c:\Users\esth633\Desktop\hk" -Filter "Microsoft.Data.Sqlite.dll" -Recurse | Select-Object -First 1
    if ($dll) { Add-Type -Path $dll.FullName } else { Write-Error "DLL not found" }
}

$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    
    Write-Host "`n--- All Unique FileCodes in DB ---"
    $cmd.CommandText = "SELECT DISTINCT FileCode FROM Returns"
    $reader = $cmd.ExecuteReader()
    while($reader.Read()) { 
        if (!$reader.IsDBNull(0)) {
            Write-Host $reader.GetString(0)
        }
    }
    $reader.Close()

    Write-Host "`n--- Count of Records ---"
    $cmd.CommandText = "SELECT COUNT(*) FROM Returns"
    $count = $cmd.ExecuteScalar()
    Write-Host "Total Records: $count"

} finally {
    $conn.Close()
}
