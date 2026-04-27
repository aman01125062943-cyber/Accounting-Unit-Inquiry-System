$path = "c:\Users\esth633\Desktop\hk\wwwroot\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# 1. Add progress modal
$modalHtml = @"
    <!-- ========== Archive Progress Modal ========== -->
    <div id="archive-progress-modal" class="modal-overlay hidden" style="z-index: 2000000;">
        <div class="modal" style="max-width: 450px; background: #0d1623; border: 1px solid #00f0ff; box-shadow: 0 0 30px rgba(0, 240, 255, 0.2);">
            <div class="modal-body" style="padding: 40px 30px; text-align: center;">
                <div class="progress-spinner" style="width: 60px; height: 60px; border: 4px solid rgba(0, 240, 255, 0.1); border-top-color: #00f0ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 25px;"></div>
                <h3 id="archive-progress-title" style="color: #fff; margin-bottom: 15px; font-size: 1.2rem;">جاري معالجة البيانات...</h3>
                <p id="archive-progress-status" style="color: #94a3b8; margin-bottom: 25px; font-size: 0.9rem;">يرجى الانتظار، يتم نقل السجلات إلى الإضابير.</p>
                <div class="progress-bar-container" style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; margin-bottom: 10px;">
                    <div id="archive-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #6366f1); transition: width 0.3s ease; box-shadow: 0 0 10px #00f0ff;"></div>
                </div>
                <div id="archive-progress-percent" style="color: #00f0ff; font-weight: bold; font-size: 1.1rem;">0%</div>
            </div>
        </div>
    </div>

"@
$content = $content.Replace('    <!-- ========== Adabir Batch Details Modal ========== -->', $modalHtml + '    <!-- ========== Adabir Batch Details Modal ========== -->')

# 2. Add button to returns page
$newButton = '                        <button class="btn-pro-action btn-adabir-pro" onclick="app.showAdabirArchiveModal()" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: 1px solid #00f0ff; box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);"><i class="fas fa-folder-plus" style="color: #fff;"></i> نقل سجلات جديد للاضابير</button>'
$targetBtn = '<button class="btn-pro-action btn-adabir-pro" onclick="app.archiveToAdabir()" id="btn-adabir-selected" style="display:none; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> حفظ في الاضابير <span id="adabir-selected-count-badge" style="background:#00f0ff; color:#0f172a; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span></button>'
$content = $content.Replace($targetBtn, $newButton + "`n" + $targetBtn)

# 3. Remove button from adabir page
# Use a more flexible match for the button from adabir page as it might have different indentation
$oldBtnPart = '<button class="btn btn-primary btn-lg" onclick="app.showAdabirArchiveModal()"'
if ($content.Contains($oldBtnPart)) {
    $startIndex = $content.IndexOf($oldBtnPart)
    # Find the nearest <div class="banner-actions"> before it
    $bannerIndex = $content.LastIndexOf('<div class="banner-actions">', $startIndex)
    # Find the nearest </div> after it
    $endDivIndex = $content.IndexOf('</div>', $startIndex)
    
    if ($bannerIndex -ge 0 -and $endDivIndex -gt $bannerIndex) {
        $toReplace = $content.Substring($bannerIndex, $endDivIndex - $bannerIndex + 6)
        $content = $content.Replace($toReplace, @"
                        <div class="banner-actions">
                            <!-- تم نقل الزر لصفحة المرتدات لسهولة الوصول -->
                        </div>
"@)
    }
}

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
