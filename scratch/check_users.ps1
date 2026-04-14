
[Reflection.Assembly]::LoadFrom("c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll")
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, Username, Password, Fullname, Role, Active FROM Users"
$reader = $cmd.ExecuteReader()
while($reader.Read()) {
    Write-Host ("ID: {0} | User: {1} | Pass: {2} | Full: {3} | Role: {4} | Active: {5}" -f $reader.GetInt64(0), $reader.GetString(1), $reader.GetString(2), $reader.GetString(3), $reader.GetString(4), $reader.GetInt32(5))
}
$conn.Close()
