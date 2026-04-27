import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\index.html"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add progress modal before adabir-details-modal or near end of body
modal_html = """
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
"""

# Insert before </body>
content = content.replace('</body>', modal_html + '</body>')

# 2. Add button to returns page
# Find the returns page actions row and add the button
new_button = '                        <button class="btn-pro-action btn-adabir-pro" onclick="app.showAdabirArchiveModal()" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: 1px solid #00f0ff; box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);"><i class="fas fa-folder-plus" style="color: #fff;"></i> نقل سجلات جديد للاضابير</button>\n'
pattern_btn = r'(<button[^>]*id="btn-adabir-selected"[^>]*>.*?</button>)'
content = re.sub(pattern_btn, new_button + r'\1', content)

# 3. Remove button from adabir page
pattern_banner = r'(<section id="page-adabir"[^>]*>.*?<div class="banner-actions">)(.*?)(</div>)'
replacement_banner = r'\1\n                            <!-- تم نقل الزر لصفحة المرتدات لسهولة الوصول -->\n                        \3'
content = re.sub(pattern_banner, replacement_banner, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
