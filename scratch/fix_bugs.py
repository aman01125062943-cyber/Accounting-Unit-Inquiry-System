import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\index.html"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# --- 1. Add Sidebar Link ---
sidebar_link = """
                    <div class="nav-item" data-page="adabir" onclick="app.navigateTo('adabir')">
                        <span class="nav-item-icon">📁</span>
                        <span class="nav-item-text">نظام الإضابير</span>
                    </div>"""

# Insert after page="archive"
if 'data-page="adabir"' not in content:
    content = re.sub(r'(<div class="nav-item" data-page="archive"[^>]*>.*?</div>)', 
                     r'\1' + sidebar_link, content, flags=re.DOTALL)

# --- 2. Add page-adabir Section ---
adabir_page = """
                <!-- ========== Adabir Page (New Archives System) ========== -->
                <section id="page-adabir" class="page-content hidden">
                    <div class="welcome-banner" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(0, 240, 255, 0.2);">
                        <div class="banner-content">
                            <h1>📁 نظام الاضابير المجمعة</h1>
                            <p>إدارة وأرشفة السجلات بشكل منظم لضمان كفاءة أداء النظام.</p>
                        </div>
                        <div class="banner-actions">
                            <!-- تم نقل الزر لصفحة المرتدات لسهولة الوصول -->
                        </div>
                    </div>

                    <div class="dashboard-controls-row-pro" style="margin-top: 20px;">
                        <div class="pro-controls-wrapper rtl-flex">
                            <div class="pro-search-container">
                                <i class="fas fa-search pro-search-icon"></i>
                                <input type="text" id="adabir-batch-search" placeholder="بحث في الدفعات (السبب أو الملفات)..." oninput="app.filterAdabirBatches(this.value)">
                            </div>
                        </div>
                    </div>

                    <div class="table-container pro-table-container">
                        <div class="table-wrapper-scroll">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th># رقم الدفعة</th>
                                        <th>تاريخ الأرشفة</th>
                                        <th>بواسطة</th>
                                        <th>مصدر البيانات</th>
                                        <th>الفترة (من - إلى)</th>
                                        <th>عدد السجلات</th>
                                        <th>السبب</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="adabir-batches-table-body">
                                    <!-- Dynamic Content -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
"""

# Insert before page-archive
if 'id="page-adabir"' not in content:
    content = content.replace('<!-- ========== Archive Page ========== -->', adabir_page + '\n                <!-- ========== Archive Page ========== -->')

# --- 3. Add Modals ---
modals = """
    <!-- ========== Adabir Reason Modal ========== -->
    <div id="adabir-reason-modal" class="modal-overlay hidden" style="z-index: 1000000;">
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                <h3 class="modal-title" style="color: #fff;"><i class="fas fa-archive" style="margin-left: 10px;"></i> أرشفة السجلات المختارة</h3>
                <button class="modal-close" onclick="app.closeAdabirReasonModal()" style="color: #fff;">✕</button>
            </div>
            <div class="modal-body" style="padding: 25px;">
                <p style="color: #94a3b8; margin-bottom: 20px; font-size: 0.95rem;">يرجى إدخال سبب حفظ هذه السجلات (سيظهر في نظام الاضابير):</p>
                <div class="form-group">
                    <textarea id="adabir-reason-input" class="form-input" rows="4" placeholder="مثال: تم السداد يدوياً بموجب شيك رقم... أو حفظ بناءً على تعليمات..." style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;"></textarea>
                    <small style="color: #f87171; display: block; margin-top: 8px;" id="adabir-reason-error" class="hidden">السبب يجب ألا يقل عن 5 أحرف.</small>
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px; background: rgba(0,0,0,0.1);">
                <button class="btn btn-secondary" onclick="app.closeAdabirReasonModal()">إلغاء</button>
                <button class="btn btn-warning" onclick="app.confirmArchiveToAdabir()" style="background: #f59e0b; color: #000; font-weight: bold;">
                    🚀 إرسال للاضابير
                </button>
            </div>
        </div>
    </div>

    <!-- ========== Adabir Archive Preview Modal ========== -->
    <div id="adabir-archive-modal" class="modal hidden" style="z-index: 9999999;">
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>📦 أرشفة سجلات جديدة</h3>
                <button class="modal-close" onclick="app.hideModal('adabir-archive-modal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>مصدر البيانات</label>
                    <select id="adabir-source-table" class="form-input">
                        <option value="Returns">مرتدات الحوافز</option>
                        <option value="SalaryReturns">مرتدات المرتبات</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>من تاريخ (تاريخ الرفع)</label>
                        <input type="date" id="adabir-date-from" class="form-input" onchange="app.previewAdabirArchive()">
                    </div>
                    <div class="form-group">
                        <label>إلى تاريخ</label>
                        <input type="date" id="adabir-date-to" class="form-input" onchange="app.previewAdabirArchive()">
                    </div>
                </div>
                
                <div id="adabir-preview-area" class="preview-card hidden" style="background: rgba(0, 240, 255, 0.05); border: 1px dashed #00f0ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: #94a3b8;">عدد السجلات المستهدفة:</span>
                        <span id="adabir-preview-count" style="color: #00f0ff; font-weight: bold;">0</span>
                    </div>
                    <div style="color: #94a3b8; font-size: 0.85rem;">
                        <span style="display: block; margin-bottom: 5px;">الملفات المتضمنة:</span>
                        <p id="adabir-preview-files" style="color: #fff; word-break: break-word;"></p>
                    </div>
                </div>

                <div class="form-group">
                    <label>سبب الحفظ (5 أحرف على الأقل)</label>
                    <textarea id="adabir-archive-reason" class="form-input" placeholder="مثلاً: تصفية عهدة شهر يناير..." rows="3"></textarea>
                </div>

                <div class="alert alert-warning" style="font-size: 0.85rem; margin-top: 10px;">
                    ⚠️ ملاحظة: سيتم نقل السجلات المحددة إلى الاضابير وحذفها من الجداول الرئيسية لتسريع أداء النظام. يمكنك استعادتها لاحقاً في أي وقت.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="app.hideModal('adabir-archive-modal')">إلغاء</button>
                <button class="btn btn-primary" id="btn-confirm-adabir-archive" onclick="app.confirmAdabirArchive()" disabled>
                    🚀 تنفيذ الأرشفة
                </button>
            </div>
        </div>
    </div>

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

    <!-- ========== Adabir Batch Details Modal ========== -->
    <div id="adabir-details-modal" class="modal hidden" style="z-index: 9999999;">
        <div class="modal-content" style="max-width: 1200px; width: 95%; height: 90vh;">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <h3>📄 تفاصيل الدفعة المؤرشفة</h3>
                    <div class="pro-search-container" style="margin: 0; min-width: 300px;">
                        <i class="fas fa-search pro-search-icon"></i>
                        <input type="text" id="adabir-detail-search" placeholder="بحث داخل هذه الدفعة..." oninput="app.searchAdabirDetails(this.value)">
                    </div>
                </div>
                <button class="modal-close" onclick="app.hideModal('adabir-details-modal')">✕</button>
            </div>
            <div class="modal-body" style="overflow: hidden; display: flex; flex-direction: column;">
                <div class="table-container pro-table-container" style="flex: 1; overflow-y: auto;">
                    <table class="data-table">
                        <thead id="adabir-details-head" style="position: sticky; top: 0; background: #0d1623; z-index: 10;"></thead>
                        <tbody id="adabir-details-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer" style="justify-content: space-between;">
                <div style="color: #94a3b8; font-size: 0.9rem;">
                    إجمالي السجلات المعروضة: <span id="adabir-detail-count" style="color: #00f0ff;">0</span>
                </div>
                <button class="btn btn-outline" onclick="app.hideModal('adabir-details-modal')">إغلاق</button>
            </div>
        </div>
    </div>
"""

# Insert modals before </body>
if 'id="adabir-archive-modal"' not in content:
    content = content.replace('</body>', modals + '\n</body>')

# --- 4. Add Buttons to returns page ---
adabir_buttons = """
                        <button class="btn-pro-action btn-adabir-pro" onclick="app.showAdabirArchiveModal()" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: 1px solid #00f0ff; box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);"><i class="fas fa-folder-plus" style="color: #fff;"></i> نقل سجلات جديد للاضابير</button>
                        <button class="btn-pro-action btn-adabir-pro" onclick="app.archiveToAdabir()" id="btn-adabir-selected" style="display:none; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> حفظ في الاضابير <span id="adabir-selected-count-badge" style="background:#00f0ff; color:#0f172a; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span></button>
"""

# Insert after export-excel-btn
if 'id="btn-adabir-selected"' not in content:
    content = re.sub(r'(<button[^>]*id="export-excel-btn"[^>]*>.*?</button>)', 
                     r'\1' + adabir_buttons, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done restoring index.html")
