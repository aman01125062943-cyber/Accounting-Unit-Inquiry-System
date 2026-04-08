
$share = "\\128.30.200.225\esth_share"
$found = Get-ChildItem -Path $share -Filter "*_be.accdb" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*deat*" } | Select-Object -First 1
if (-not $found) {
    # Try direct path if search fails
    $part1 = "فرع الاعمال الحسابية"
    $part2 = "قسم البنوك"
    $part3 = "برنامج ارشيف البنوك"
    $dbPath = Join-Path $share $part1 | Join-Path -ChildPath $part2 | Join-Path -ChildPath $part3 | Join-Path -ChildPath "deat" | Join-Path -ChildPath "ارشيف قسم البنوك_be.accdb"
}
else {
    $dbPath = $found.FullName
}
Write-Host "Target DB: $dbPath"

$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
    $tables = $conn.OpenSchema(20) # adSchemaTables
    Write-Host "--- Tables ---"
    while (!$tables.EOF) {
        if ($tables.Fields.Item("TABLE_TYPE").Value -eq "TABLE") {
            $tableName = $tables.Fields.Item("TABLE_NAME").Value
            Write-Host "Table: $tableName"
            
            # List columns for this table
            $columns = $conn.OpenSchema(4) # adSchemaColumns
            $columns.Filter = "TABLE_NAME = '$tableName'"
            while (!$columns.EOF) {
                Write-Host "  Column: $($columns.Fields.Item('COLUMN_NAME').Value)"
                $columns.MoveNext()
            }
        }
        $tables.MoveNext()
    }
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    if ($conn.State -eq 1) { $conn.Close() }
}
