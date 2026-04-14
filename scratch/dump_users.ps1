
[Reflection.Assembly]::LoadFrom("c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll")
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, Username, Fullname, Role, Active FROM Users"
$reader = $cmd.ExecuteReader()
Write-Host "Id | Username | Fullname | Role | Active"
Write-Host "----------------------------------------"
while($reader.Read()) {
    $id = $reader.GetValue(0)
    $username = $reader.GetValue(1)
    $fullname = $reader.GetValue(2)
    $role = $reader.GetValue(3)
    $active = $reader.GetValue(4)
    Write-Host "$id | $username | $fullname | $role | $active"
}
$conn.Close()
