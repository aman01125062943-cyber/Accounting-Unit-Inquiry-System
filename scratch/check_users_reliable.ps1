
try {
    Add-Type -Path "c:\Users\esth633\Desktop\hk\bin\Debug\net8.0\Microsoft.Data.Sqlite.dll"
    $conn = New-Object Microsoft.Data.Sqlite.SqliteConnection("Data Source=c:\Users\esth633\Desktop\hk\hk.db")
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT Id, Username, Fullname, Active FROM Users"
    $reader = $cmd.ExecuteReader()
    Write-Host "ID | Username | Fullname | Active"
    Write-Host "----------------------------------"
    while($reader.Read()) {
        $id = $reader.GetValue(0)
        $user = $reader.GetValue(1)
        $full = $reader.GetValue(2)
        $act = $reader.GetValue(3)
        Write-Host "$id | $user | $full | $act"
    }
    $conn.Close()
} catch {
    Write-Error $_.Exception.Message
}
