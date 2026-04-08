
$dbPath = "\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\برنامج ارشيف البنوك\deat\ارشيف قسم البنوك_be.accdb"
$destFolder = Join-Path ([Environment]::GetFolderPath("Desktop")) "Attachments_Export"

if (!(Test-Path $destFolder)) {
    New-Item -ItemType Directory -Path $destFolder
}

$conn = New-Object -ComObject ADODB.Connection
try {
    Write-Host "Connecting to database..."
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
    
    $rs = New-Object -ComObject ADODB.Recordset
    $rs.Open("SELECT * FROM Doc", $conn, 1, 3) # 1 = adOpenKeyset, 3 = adLockOptimistic

    Write-Host "Scanning records..."
    $count = 0
    while (!$rs.EOF) {
        $fullName = $null
        $filePath = $null
        
        # البحث عن الحقول المطلوبة بحسب الاسم
        foreach ($f in $rs.Fields) {
            if ($f.Name -like "*الاسم*") { $fullName = $f.Value }
            if ($f.Name -like "*مسار*" -or $f.Name -like "*Path*") { $filePath = $f.Value }
        }

        if ($fullName -and $filePath) {
            $fPathStr = $filePath.ToString().Trim()
            if (Test-Path $fPathStr) {
                # تقسيم الأسماء إذا وجد الفاصل /
                $names = $fullName.ToString() -split "/"
                foreach ($name in $names) {
                    $cleanName = $name.Trim() -replace '[\\/:*?"<>|]', ''
                    if ($cleanName) {
                        $targetPath = Join-Path $destFolder ($cleanName + ".pdf")
                        try {
                            Copy-Item -Path $fPathStr -Destination $targetPath -Force
                            Write-Host "Success: $cleanName"
                            $count++
                        }
                        catch {
                            Write-Warning "Failed to copy: $cleanName"
                        }
                    }
                }
            }
            else {
                Write-Host "File not found: $fPathStr" -ForegroundColor Yellow
            }
        }
        $rs.MoveNext()
    }
    $rs.Close()
    Write-Host "`nFinished! Total files copied/renamed: $count" -ForegroundColor Green
    Write-Host "Destination: $destFolder"
}
catch {
    Write-Error "Database Error: $($_.Exception.Message)"
}
finally {
    if ($conn.State -eq 1) { $conn.Close() }
}
