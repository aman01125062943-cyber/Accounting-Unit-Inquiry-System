
# ط³ظƒط±ظٹط¨طھ طھطµط¯ظٹط± ط§ظ„ظ…ط±ظپظ‚ط§طھ ظ…ط¹ طھط¬ظ†ط¨ ط§ظ„ط­ط±ظˆظپ ط§ظ„ط¹ط±ط¨ظٹط© ظپظٹ ط§ظ„ظƒظˆط¯ ظ„طھظپط§ط¯ظٹ ظ…ط´ط§ظƒظ„ ط§ظ„طھط±ظ…ظٹط²
$share = "\\128.30.200.225\esth_share"

Write-Host "Searching for database file..."
$dbFile = Get-ChildItem -Path $share -Filter "*_be.accdb" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*deat*" } | Select-Object -First 1

if (-not $dbFile) {
    Write-Error "Could not find the database file in deat folder."
    return
}

$dbPath = $dbFile.FullName
Write-Host "Found DB: $dbPath"

$destFolder = Join-Path ([Environment]::GetFolderPath("Desktop")) "Attachments_Export"
if (!(Test-Path $destFolder)) {
    New-Item -ItemType Directory -Path $destFolder | Out-Null
}

$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;")
    $rs = New-Object -ComObject ADODB.Recordset
    $rs.Open("SELECT * FROM Doc", $conn, 1, 3)

    # ط£ظƒظˆط§ط¯ ط§ظ„ظٹظˆظ†ظٹ ظƒظˆط¯ ظ„ظ„ظƒظ„ظ…ط§طھ ط§ظ„ط¹ط±ط¨ظٹط© (ط§ظ„ط§ط³ظ…طŒ ظ…ط³ط§ط±)
    $arabicNameKey = [char]0x0627 + [char]0x0644 + [char]0x0627 + [char]0x0633 + [char]0x0645 # ط§ظ„ط§ط³ظ…
    $arabicPathKey = [char]0x0645 + [char]0x0633 + [char]0x0627 + [char]0x0631 # ظ…ط³ط§ط±

    $count = 0
    while (!$rs.EOF) {
        $fullName = $null
        $filePath = $null
        
        foreach ($f in $rs.Fields) {
            if ($f.Name -like "*$arabicNameKey*") { $fullName = $f.Value }
            if ($f.Name -like "*$arabicPathKey*" -or $f.Name -like "*Path*") { $filePath = $f.Value }
        }

        if ($fullName -and $filePath) {
            $fPathStr = $filePath.ToString().Trim()
            if (Test-Path $fPathStr) {
                $names = $fullName.ToString() -split "/"
                foreach ($name in $names) {
                    $cleanName = $name.Trim() -replace '[\\/:*?"<>|]', ''
                    if ($cleanName) {
                        $targetPath = Join-Path $destFolder ($cleanName + ".pdf")
                        try {
                            Copy-Item -Path $fPathStr -Destination $targetPath -Force
                            Write-Host "Copied: $cleanName"
                            $count++
                        } catch {
                            Write-Warning "Failed to copy: $cleanName"
                        }
                    }
                }
            }
        }
        $rs.MoveNext()
    }
    $rs.Close()
    Write-Host "Done! Total files: $count"
} catch {
    Write-Error "Error: $($_.Exception.Message)"
} finally {
    if ($conn.State -eq 1) { $conn.Close() }
}
