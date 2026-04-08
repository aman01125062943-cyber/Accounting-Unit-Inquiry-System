
$dbPath = "\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\برنامج ارشيف البنوك\deat\ارشيف قسم البنوك_be.accdb"
$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
    $rs = $conn.OpenSchema(4) # adSchemaColumns
    $rs.Filter = "TABLE_NAME = 'Doc'"
    Write-Host "Columns in 'Doc':"
    while (!$rs.EOF) {
        Write-Host "- $($rs.Fields.Item('COLUMN_NAME').Value)"
        $rs.MoveNext()
    }
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    if ($conn.State -eq 1) { $conn.Close() }
}
