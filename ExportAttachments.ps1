
$dbPath = "\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\برنامج ارشيف البنوك\deat\ارشيف قسم البنوك_be.accdb"
$destFolder = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"), "Attachments_Export")
if (!(Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder }

$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
    $rs = New-Object -ComObject ADODB.Recordset
    $rs.Open("SELECT * FROM Doc", $conn, 1, 3)

    while (!$rs.EOF) {
        $fullName = $rs.Fields.Item("الاسم").Value
        $filePath = $rs.Fields.Item("مسار_الملف").Value

        if ($fullName -and $filePath -and (Test-Path $filePath)) {
            $names = $fullName -split " / "
            foreach ($name in $names) {
                $cleanName = $name.Trim() -replace '[\\\/:*?"<>|]', ''
                $targetPath = [System.IO.Path]::Combine($destFolder, "$cleanName.pdf")
                Copy-Item -Path $filePath -Destination $targetPath -Force
                Write-Host "Copied: $cleanName"
            }
        }
        $rs.MoveNext()
    }
    $rs.Close()
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    if ($conn.State -eq 1) { $conn.Close() }
}
