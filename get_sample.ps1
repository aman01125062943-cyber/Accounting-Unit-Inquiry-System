
try {
    Add-Type -Path "c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll"
} catch {
    $dll = Get-ChildItem -Path "c:\Users\esth633\Desktop\hk" -Filter "Microsoft.Data.Sqlite.dll" -Recurse | Select-Object -First 1
    if ($dll) { Add-Type -Path $dll.FullName }
}

$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT RawData FROM Returns WHERE RawData IS NOT NULL LIMIT 5"
    $reader = $cmd.ExecuteReader()
    while($reader.Read()) {
        $raw = $reader.GetString(0)
        # Output as Base64 to avoid encoding issues in terminal if needed, 
        # but let's try direct first and see.
        Write-Host "--- DATA ---"
        Write-Host $raw
    }
} finally {
    if ($conn) { $conn.Close() }
}
