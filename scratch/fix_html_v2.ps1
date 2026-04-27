$path = "c:\Users\esth633\Desktop\hk\wwwroot\index.html"
$content = [System.IO.File]::ReadAllLines($path)
$newContent = New-Object System.Collections.Generic.List[string]

# Copy up to line 2506 (0-indexed 2505)
for ($i=0; $i -lt 2506; $i++) { $newContent.Add($content[$i]) }

# Add the fix
$newContent.Add('                </button>')
$newContent.Add('            </div>')
$newContent.Add('        </div>')
$newContent.Add('    </div>')
$newContent.Add('')
$newContent.Add('    <!-- ========== Archive Progress Modal ========== -->')
$newContent.Add('    <div id="archive-progress-modal" class="modal-overlay hidden" style="z-index: 2000000;">')
$newContent.Add('        <div class="modal" style="max-width: 450px; background: #0d1623; border: 1px solid #00f0ff; box-shadow: 0 0 30px rgba(0, 240, 255, 0.2);">')
$newContent.Add('            <div class="modal-body" style="padding: 40px 30px; text-align: center;">')
$newContent.Add('                <div class="progress-spinner" style="width: 60px; height: 60px; border: 4px solid rgba(0, 240, 255, 0.1); border-top-color: #00f0ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 25px;"></div>')
$newContent.Add('                <h3 id="archive-progress-title" style="color: #fff; margin-bottom: 15px; font-size: 1.2rem;">جاري معالجة البيانات...</h3>')
$newContent.Add('                <p id="archive-progress-status" style="color: #94a3b8; margin-bottom: 25px; font-size: 0.9rem;">يرجى الانتظار، يتم نقل السجلات إلى الإضابير.</p>')
$newContent.Add('                <div class="progress-bar-container" style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; margin-bottom: 10px;">')
$newContent.Add('                    <div id="archive-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #6366f1); transition: width 0.3s ease; box-shadow: 0 0 10px #00f0ff;"></div>')
$newContent.Add('                </div>')
$newContent.Add('                <div id="archive-progress-percent" style="color: #00f0ff; font-weight: bold; font-size: 1.1rem;">0%</div>')
$newContent.Add('            </div>')
$newContent.Add('        </div>')
$newContent.Add('    </div>')
$newContent.Add('')
$newContent.Add('    <!-- ========== Adabir Batch Details Modal ========== -->')
$newContent.Add('    <div id="adabir-details-modal" class="modal hidden" style="z-index: 9999999;">')
$newContent.Add('        <div class="modal-content" style="max-width: 1200px; width: 95%; height: 90vh;">')
$newContent.Add('            <div class="modal-header">')
$newContent.Add('                <div style="display: flex; align-items: center; gap: 15px;">')
$newContent.Add('                    <h3>📄 تفاصيل الدفعة المؤرشفة</h3>')
$newContent.Add('                    <div class="pro-search-container" style="margin: 0; min-width: 300px;">')

# Skip corrupted lines 2507 to 2512 (0-indexed 2506 to 2511)
# And add the rest of the file
for ($i=2512; $i -lt $content.Count; $i++) { $newContent.Add($content[$i]) }

[System.IO.File]::WriteAllLines($path, $newContent)
