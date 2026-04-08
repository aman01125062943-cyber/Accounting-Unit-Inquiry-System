
# إنشاء نص PowerShell مباشرة في ملف مع تجنب مشاكل الترميز
$scriptContent = @"
`$dbPath = '\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\برنامج ارشيف البنوك\deat\ارشيف قسم البنوك_be.accdb'
`$destFolder = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Attachments_Export')
if (!(Test-Path `$destFolder)) { New-Item -ItemType Directory -Path `$destFolder }

`$conn = New-Object -ComObject ADODB.Connection
try {
    `$conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=`$dbPath;")
    `$rs = New-Object -ComObject ADODB.Recordset
    # محاولة استعلام مرنة في حال كانت أسماء الحقول مختلفة
    `$rs.Open("SELECT * FROM Doc", `$conn, 1, 3)

    Write-Host "Starting export..."
    while (!`$rs.EOF) {
        # محاولة جلب الحقول بناءً على احتمالات الأسماء (الاسم، مسار)
        `$fullName = `$null
        `$filePath = `$null
        
        foreach (`$f in `$rs.Fields) {
            if (`$f.Name -like "*الاسم*") { `$fullName = `$f.Value }
            if (`$f.Name -like "*مسار*" -or `$f.Name -like "*Path*") { `$filePath = `$f.Value }
        }

        if (`$fullName -and `$filePath) {
            # إزالة المسافات الزائدة في بداية ونهاية مسار الملف قبل فحصه
            `$filePath = `$filePath.Trim()
            if (Test-Path `$filePath) {
                `$names = `$fullName -split " / "
                foreach (`$name in `$names) {
                    `$cleanName = `$name.Trim() -replace '[\x5C\x2F\x3A\x2A\x3F\x22\x3C\x3E\x7C]', ''
                    if (`$cleanName) {
                        `$targetPath = [System.IO.Path]::Combine(`$destFolder, "`$cleanName.pdf")
                        Copy-Item -Path `$filePath -Destination `$targetPath -Force
                        Write-Host "Copied: `$cleanName"
                    }
                }
            } else {
                Write-Warning "File not found: `$filePath"
            }
        }
        `$rs.MoveNext()
    }
    `$rs.Close()
    Write-Host "Export completed to `$destFolder"
} catch {
    Write-Error `$_.Exception.Message
} finally {
    if (`$conn.State -eq 1) { `$conn.Close() }
}
"@

# حفظ الملف بترميز UTF-8 مع BOM لضمان قراءة الحروف العربية في PowerShell
$utf8WithBom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText("C:\Users\esth633\Desktop\hk\FinalExport.ps1", $scriptContent, $utf8WithBom)
