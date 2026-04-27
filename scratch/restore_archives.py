import os
import re

# --- 1. Modify app.js ---
app_path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

archives_js = """
// ============================================================
// Archives System (Adabir) - Professional Implementation
// ============================================================

App.prototype.archiveToAdabir = function(source = 'Returns') {
    const tableId = source === 'salary' || source === 'SalaryReturns' ? 'salary-returns-table' : 'returns-table';
    const checkedBoxes = document.querySelectorAll(`#${tableId} .return-row-checkbox:checked`);
    
    if (checkedBoxes.length === 0) {
        this.showToast('يرجى تحديد السجلات أولاً', 'warning');
        return;
    }

    this.currentArchiveSource = source === 'salary' || source === 'SalaryReturns' ? 'SalaryReturns' : 'Returns';
    this.currentArchiveIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    const modal = document.getElementById('adabir-reason-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('adabir-reason-input').value = '';
        document.getElementById('adabir-reason-error').classList.add('hidden');
    }
};

App.prototype.closeAdabirReasonModal = function() {
    document.getElementById('adabir-reason-modal')?.classList.add('hidden');
};

App.prototype.confirmArchiveToAdabir = async function() {
    const reasonInput1 = document.getElementById('adabir-reason-input');
    const reason = (reasonInput1?.value || '').trim();
    
    if (!reason || reason.length < 5) {
        this.showToast('السبب قصير جداً (5 أحرف على الأقل)', 'warning');
        return;
    }
    
    this.showArchiveProgress(30, 'جاري نقل السجلات المختارة...');
    
    try {
        const response = await fetch('/api/adabir/archive-selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Ids: this.currentArchiveIds,
                SourceTable: this.currentArchiveSource,
                Reason: reason,
                User: this.currentUser?.fullname || 'مستخدم'
            })
        });
        
        const result = await response.json();
        this.showArchiveProgress(100, 'تمت الأرشفة بنجاح');
        
        if (result.success) {
            this.showToast(`تم نقل ${result.count} سجل للأرشيف بنجاح`, 'success');
            this.hideModal('adabir-reason-modal');
            this.resetAllFilters();
        } else {
            this.showToast('فشلت العملية: ' + (result.message || 'خطأ غير معروف'), 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال', 'error');
    } finally {
        setTimeout(() => this.hideModal('archive-progress-modal'), 1000);
    }
};

App.prototype.showAdabirArchiveModal = function(source = 'Returns') {
    const modal = document.getElementById('adabir-archive-modal');
    if (!modal) return;
    
    document.getElementById('adabir-source-table').value = source;
    document.getElementById('adabir-archive-reason').value = '';
    document.getElementById('adabir-date-from').value = '';
    document.getElementById('adabir-date-to').value = '';
    document.getElementById('adabir-preview-area').classList.add('hidden');
    document.getElementById('btn-confirm-adabir-archive').disabled = true;
    
    modal.classList.remove('hidden');
};

App.prototype.previewAdabirArchive = async function() {
    const source = document.getElementById('adabir-source-table').value;
    const from = document.getElementById('adabir-date-from').value;
    const to = document.getElementById('adabir-date-to').value;
    
    if (!from || !to) return;
    
    try {
        const url = `/api/adabir/preview?sourceTable=${source}&dateFrom=${from}&dateTo=${to}`;
        const response = await fetch(url);
        const result = await response.json();
        
        const previewArea = document.getElementById('adabir-preview-area');
        const countEl = document.getElementById('adabir-preview-count');
        const filesEl = document.getElementById('adabir-preview-files');
        const confirmBtn = document.getElementById('btn-confirm-adabir-archive');
        
        previewArea.classList.remove('hidden');
        countEl.textContent = result.count.toLocaleString();
        filesEl.textContent = result.excelNames || 'لا توجد ملفات محددة';
        
        confirmBtn.disabled = result.count === 0;
    } catch (e) {
        console.error('Preview failed:', e);
    }
};

App.prototype.confirmAdabirArchive = async function() {
    const source = document.getElementById('adabir-source-table').value;
    const from = document.getElementById('adabir-date-from').value;
    const to = document.getElementById('adabir-date-to').value;
    const reason = document.getElementById('adabir-archive-reason').value.trim();
    
    if (reason.length < 5) {
        this.showToast('السبب قصير جداً (5 أحرف على الأقل)', 'warning');
        return;
    }
    
    this.showArchiveProgress(40, 'جاري أرشفة السجلات الجديدة...');
    
    try {
        const response = await fetch('/api/adabir/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                DateFrom: from,
                DateTo: to,
                SourceTable: source,
                Reason: reason,
                User: this.currentUser?.fullname || 'مستخدم'
            })
        });
        
        const result = await response.json();
        this.showArchiveProgress(100, 'اكتملت العملية');
        
        if (result.success) {
            this.showToast('تمت الأرشفة بنجاح', 'success');
            this.hideModal('adabir-archive-modal');
            this.resetAllFilters();
        } else {
            this.showToast('فشل: ' + result.message, 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال', 'error');
    } finally {
        setTimeout(() => this.hideModal('archive-progress-modal'), 1000);
    }
};

App.prototype.showArchiveProgress = function(percent, status) {
    const modal = document.getElementById('archive-progress-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.getElementById('archive-progress-bar').style.width = percent + '%';
    document.getElementById('archive-progress-percent').textContent = percent + '%';
    document.getElementById('archive-progress-status').textContent = status;
};

App.prototype.resetAllFilters = function() {
    this.searchQuery = '';
    this.filterValue = 'all';
    this.monthFilterValue = 'all';
    this.statusFilterValue = 'all';
    this.settlementFilterValue = 'all';
    this.attachmentFilterValue = 'all';
    this.dateFromFilter = '';
    this.dateToFilter = '';
    
    // Reset UI inputs
    const ids = ['table-search', 'month-filter', 'status-filter', 'settlement-filter', 'attachment-status-filter', 'date-from', 'date-to'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.tagName === 'SELECT' ? 'all' : '';
    });

    // Clear caches
    this.returnsCache = null;
    this.salaryReturnsCache = null;
    if (this.db) {
        this.db.clearLocalCache('returns_cache');
        this.db.clearLocalCache('salary_returns_cache');
    }
    
    // Refresh
    this.loadReturns();
};
"""

# Append to app.js if not present
if "App.prototype.archiveToAdabir" not in app_content:
    with open(app_path, 'a', encoding='utf-8') as f:
        f.write("\n\n" + archives_js)

# --- 2. Modify index.html ---
index_path = r"c:\Users\esth633\Desktop\hk\wwwroot\index.html"
with open(index_path, 'r', encoding='utf-8') as f:
    index_content = f.read()

# Restore missing modals
adabir_modals = """
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
"""

if "archive-progress-modal" not in index_content:
    index_content = index_content.replace('</body>', adabir_modals + '</body>')

# Add Buttons to returns page
btn_group = """
                        <button class="btn-pro-action btn-adabir-pro" onclick="app.showAdabirArchiveModal()" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: 1px solid #00f0ff; box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);"><i class="fas fa-folder-plus" style="color: #fff;"></i> نقل سجلات جديد للاضابير</button>
                        <button class="btn-pro-action btn-adabir-pro" onclick="app.archiveToAdabir()" id="btn-adabir-selected" style="display:none; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> حفظ في الاضابير <span id="adabir-selected-count-badge" style="background:#00f0ff; color:#0f172a; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span></button>
"""

# Insert buttons in dashboard-actions-row-pro
if "btn-adabir-selected" not in index_content:
    index_content = re.sub(r'(<button[^>]*class="btn-pro-action btn-export-pro"[^>]*id="export-excel-btn"[^>]*>.*?</button>)', 
                           btn_group + r'\1', index_content)

# Update page-adabir banner
pattern_banner = r'(<section id="page-adabir"[^>]*>.*?<div class="banner-actions">)(.*?)(</div>)'
replacement_banner = r'\1\n                            <!-- تم نقل الزر لصفحة المرتدات لسهولة الوصول -->\n                        \3'
index_content = re.sub(pattern_banner, replacement_banner, index_content, flags=re.DOTALL)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_content)

print("Restoration and Implementation Complete")
