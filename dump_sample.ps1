try {
    Add-Type -Path "c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll"
    $conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT RawData FROM Returns LIMIT 3"
    $reader = $cmd.ExecuteReader()
    $out = "c:\Users\esth633\Desktop\hk\sample.txt"
    Clear-Content $out -ErrorAction SilentlyContinue
    while($reader.Read()) {
        $reader.GetString(0) | Out-File -Append -FilePath $out -Encoding utf8
    }
} catch {
    Write-Host "Error: $_"
} finally {
    if ($conn) { $conn.Close() }
}
