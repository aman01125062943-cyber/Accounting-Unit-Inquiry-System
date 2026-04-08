
[Reflection.Assembly]::LoadFrom("c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll")
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT RawData FROM Returns WHERE RawData IS NOT NULL LIMIT 3"
$reader = $cmd.ExecuteReader()
while($reader.Read()) {
    Write-Host "--- RECORD ---"
    Write-Host $reader.GetString(0)
}
$conn.Close()
