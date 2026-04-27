import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\index.html"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

filter_bar = """
                    <!-- ========== Inline Bulk Archive Bar ========== -->
                    <div id="bulk-archive-filter-bar" class="hidden" style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(0, 240, 255, 0.2); padding: 15px; border-radius: 12px; margin-top: 15px; display: flex; align-items: center; gap: 20px; animation: slideDown 0.3s ease-out;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="color: #94a3b8; font-size: 0.9rem;">من تاريخ:</label>
                            <input type="date" id="bulk-archive-from" class="form-input" style="width: 160px; background: rgba(0,0,0,0.2);" onchange="app.previewBulkArchive()">
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="color: #94a3b8; font-size: 0.9rem;">إلى تاريخ:</label>
                            <input type="date" id="bulk-archive-to" class="form-input" style="width: 160px; background: rgba(0,0,0,0.2);" onchange="app.previewBulkArchive()">
                        </div>
                        <div id="bulk-archive-preview-info" style="color: #00f0ff; font-weight: bold; font-size: 0.9rem; margin-right: auto;">
                            <i class="fas fa-info-circle"></i> اختر التاريخ للمعاينة
                        </div>
                        <button class="btn btn-primary" onclick="app.startBulkArchiveBatch()" style="padding: 8px 25px; background: #0ea5e9;">
                             🚀 أرشفة الفترة المحددة
                        </button>
                        <button class="btn-icon" onclick="app.toggleBulkArchiveBar()" style="color: #94a3b8;">✕</button>
                    </div>"""

if 'id="bulk-archive-filter-bar"' not in content:
    content = content.replace('<div class="dashboard-actions-row-pro rtl-flex">', 
                              '<div class="dashboard-actions-row-pro rtl-flex">', 1)
    # Insert after the closing </div> of that row
    pattern = r'(<div class="dashboard-actions-row-pro rtl-flex">.*?</div>)'
    content = re.sub(pattern, r'\1' + filter_bar, content, count=1, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Filter bar correctly inserted")
