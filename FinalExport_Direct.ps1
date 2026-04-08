
# سكريبت تصدير المرفقات - نسخة مباشرة وسريعة
$dbPath = "\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\برنامج ارشيف البنوك\deat\ارشيف قسم البنوك_be.accdb"
$destFolder = Join-Path ([Environment]::GetFolderPath("Desktop")) "Attachments_Export"

Write-Host "Checking database access..."
if (!(Test-Path $dbPath)) {
    Write-Error "Cannot access database at: $dbPath"
    return
}

if (!(Test-Path $destFolder)) {
    New-Item -ItemType Directory -Path $destFolder | Out-Null
}

$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
    $rs = New-Object -ComObject ADODB.Recordset
    $rs.Open("SELECT * FROM Doc", $conn, 1, 3)

    $count = 0
    Write-Host "Exporting files..."
    
    while (!$rs.EOF) {
        $fullName = $null
        $filePath = $null
        
        foreach ($f in $rs.Fields) {
            # استخدام مطابقة بسيطة لتجنب مشاكل الترميز في أسماء الحقول
            if ($f.Name -match "الاسم|name") { $fullName = $f.Value }
            if ($f.Name -match "مسار|path") { $filePath = $f.Value }
        }

        if ($fullName -and $filePath) {
            $fPathStr = $filePath.ToString().Trim()
            if (Test-Path $fPathStr) {
                # معالجة الأسماء المتعددة
                $names = $fullName.ToString() -split "[/|]"
                foreach ($name in $names) {
                    $cleanName = $name.Trim() -replace '[\x5C\x2F\x3A\x2A\x3F\x22\x3C\x3E\x7C]', ''
                    if ($cleanName) {
                        $targetPath = Join-Path $destFolder ($cleanName + ".pdf")
                        try {
                            Copy-Item -Path $fPathStr -Destination $targetPath -Force
                            Write-Host "Done: $cleanName"
                            $count++
                        }
                        catch { }
                    }
                }
            }
        }
        $rs.MoveNext()
    }
    $rs.Close()
    Write-Host "`nExport Finished! Total files in Desktop\Attachments_Export: $count"
}
catch {
    Write-Error "Error: $($_.Exception.Message)"
}
finally {
    if ($conn.State -eq 1) { $conn.Close() }
}
