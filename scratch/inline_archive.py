import os
import re

index_path = r"c:\Users\esth633\Desktop\hk\wwwroot\index.html"
with open(index_path, 'r', encoding='utf-8') as f:
    index_content = f.read()

# --- 1. Add Inline Filter Bar to index.html ---
# We'll place it right after the dashboard-actions-row-pro in the returns page.
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
                    </div>
"""

# Find the end of dashboard-actions-row-pro in returns page
if 'id="bulk-archive-filter-bar"' not in index_content:
    # Use re.sub to find the button group and insert after it
    index_content = re.sub(r'(<div class="dashboard-actions-row-pro">.*?</div>)', 
                           r'\1' + filter_bar, index_content, count=1, flags=re.DOTALL)

# --- 2. Update the "Move New Records" button to toggle the bar instead of modal ---
index_content = index_content.replace('onclick="app.showAdabirArchiveModal()"', 'onclick="app.toggleBulkArchiveBar()"')

# --- 3. Remove the old adabir-archive-modal ---
# (Keep the reason modal as it will be used for final confirmation)
index_content = re.sub(r'<!-- ========== Adabir Archive Preview Modal ========== -->.*?<!-- ========== Archive Progress Modal ========== -->', 
                       '<!-- ========== Archive Progress Modal ========== -->', index_content, flags=re.DOTALL)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_content)

# --- 4. Update app.js logic ---
app_path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

inline_archive_js = """
// ========================================
// Inline Bulk Archive Logic
// ========================================

App.prototype.toggleBulkArchiveBar = function() {
    const bar = document.getElementById('bulk-archive-filter-bar');
    if (!bar) return;
    
    if (bar.classList.contains('hidden')) {
        bar.classList.remove('hidden');
        bar.style.display = 'flex';
        // Reset inputs
        document.getElementById('bulk-archive-from').value = '';
        document.getElementById('bulk-archive-to').value = '';
        document.getElementById('bulk-archive-preview-info').innerHTML = '<i class="fas fa-info-circle"></i> اختر التاريخ للمعاينة';
    } else {
        bar.classList.add('hidden');
        bar.style.display = 'none';
        // Reset table filters if they were set
        this.dateFromFilter = '';
        this.dateToFilter = '';
        this.loadReturns();
    }
};

App.prototype.previewBulkArchive = async function() {
    const from = document.getElementById('bulk-archive-from').value;
    const to = document.getElementById('bulk-archive-to').value;
    
    if (!from || !to) return;
    
    // Apply as temporary filters to the table so user can see what will be archived
    this.dateFromFilter = from;
    this.dateToFilter = to;
    
    const infoEl = document.getElementById('bulk-archive-preview-info');
    infoEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
    
    try {
        // We use the same preview API to get counts
        const source = this.currentPage === 'salary-returns' ? 'SalaryReturns' : 'Returns';
        const url = `/api/adabir/preview?sourceTable=${source}&dateFrom=${from}&dateTo=${to}`;
        const response = await fetch(url);
        const result = await response.json();
        
        infoEl.innerHTML = `<i class="fas fa-check-circle"></i> سيتم أرشفة ${result.count.toLocaleString()} سجل`;
        
        // Refresh the main table so user sees the records
        this.loadReturns();
    } catch (e) {
        infoEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في المعاينة';
    }
};

App.prototype.startBulkArchiveBatch = function() {
    const from = document.getElementById('bulk-archive-from').value;
    const to = document.getElementById('bulk-archive-to').value;
    
    if (!from || !to) {
        this.showToast('يرجى تحديد الفترة أولاً', 'warning');
        return;
    }
    
    // Check if there's anything to archive (from preview info)
    const infoText = document.getElementById('bulk-archive-preview-info').textContent;
    if (infoText.includes(' 0 ')) {
        this.showToast('لا توجد سجلات في هذه الفترة', 'warning');
        return;
    }

    // Open the reason modal
    this.currentBulkArchiveData = { from, to, source: this.currentPage === 'salary-returns' ? 'SalaryReturns' : 'Returns' };
    this.showModal('adabir-reason-modal');
    document.getElementById('adabir-reason-input').value = '';
};

// Override the old confirmAdabirArchive to handle both manual and bulk (inline)
App.prototype.confirmAdabirArchive = async function() {
    // This is now called from adabir-reason-modal for BULK archive
    const data = this.currentBulkArchiveData;
    if (!data) return;
    
    const reason = document.getElementById('adabir-reason-input').value.trim();
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
                DateFrom: data.from,
                DateTo: data.to,
                SourceTable: data.source,
                Reason: reason,
                User: this.currentUser?.fullname || 'مستخدم'
            })
        });
        
        const result = await response.json();
        this.showArchiveProgress(100, 'اكتملت العملية');
        
        if (result.success) {
            this.showToast('تمت الأرشفة بنجاح', 'success');
            this.hideModal('adabir-reason-modal');
            this.toggleBulkArchiveBar(); // Hide the bar
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
"""

# Append or replace in app.js
if "App.prototype.toggleBulkArchiveBar" not in app_content:
    # We'll replace the old confirmAdabirArchive and other modal-related ones with the new inline ones
    app_content = re.sub(r'App\.prototype\.showAdabirArchiveModal = function.*?App\.prototype\.confirmAdabirArchive = async function\(.*?\n};', 
                         inline_archive_js, app_content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Inline Bulk Archive Implementation Complete")
