import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update navigateTo logic
if "if (page === 'adabir') this.loadAdabirBatches();" not in content:
    content = content.replace("if (page === 'archive') this.loadArchive();", 
                              "if (page === 'archive') this.loadArchive();\n            if (page === 'adabir') this.loadAdabirBatches();")

# 2. Add Titles for adabir
if "'adabir': { icon: '📁', text: 'نظام الإضابير' }" not in content:
    content = content.replace("archive: { icon: '🗄️', text: 'الأرشيف' },", 
                              "archive: { icon: '🗄️', text: 'الأرشيف' },\n            adabir: { icon: '📁', text: 'نظام الإضابير' },")

# 3. Add Adabir Page Logic
adabir_logic = """
// ========================================
// Adabir System Page Logic
// ========================================

App.prototype.loadAdabirBatches = async function() {
    try {
        const response = await fetch('/api/adabir');
        this.adabirBatches = await response.json();
        this.renderAdabirBatches(this.adabirBatches);
    } catch (e) {
        console.error('Failed to load adabir batches:', e);
        this.showToast('فشل تحميل دفعات الإضابير', 'error');
    }
};

App.prototype.renderAdabirBatches = function(batches) {
    const tbody = document.getElementById('adabir-batches-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = batches.map(b => `
        <tr>
            <td>#${b.Id || b.id}</td>
            <td>${b.ArchivedAt || b.archivedAt}</td>
            <td>${b.ArchivedBy || b.archivedBy}</td>
            <td>${b.SourceTable === 'Returns' ? 'مرتدات الحوافز' : 'مرتدات المرتبات'}</td>
            <td>${b.DateFrom} - ${b.DateTo}</td>
            <td><span class="badge badge-info">${(b.RecordCount || b.recordCount).toLocaleString()}</span></td>
            <td title="${b.Reason}">${b.Reason.substring(0, 30)}${b.Reason.length > 30 ? '...' : ''}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon btn-view" title="عرض التفاصيل" onclick="app.showAdabirBatchDetails(${b.Id || b.id})">👁️</button>
                    <button class="btn-icon btn-restore" title="استعادة" onclick="app.restoreAdabirBatch(${b.Id || b.id})">🔄</button>
                </div>
            </td>
        </tr>
    `).join('');
};

App.prototype.filterAdabirBatches = function(query) {
    if (!this.adabirBatches) return;
    const filtered = this.adabirBatches.filter(b => 
        b.Reason.toLowerCase().includes(query.toLowerCase()) || 
        b.FileNames.toLowerCase().includes(query.toLowerCase())
    );
    this.renderAdabirBatches(filtered);
};

App.prototype.showAdabirBatchDetails = async function(id) {
    try {
        this.showLoading();
        const response = await fetch(`/api/adabir/${id}/details`);
        const details = await response.json();
        this.hideLoading();
        
        this.currentAdabirBatchDetails = details;
        this.renderAdabirBatchDetails(details);
        this.showModal('adabir-details-modal');
        document.getElementById('adabir-detail-search').value = '';
    } catch (e) {
        this.hideLoading();
        this.showToast('فشل تحميل التفاصيل', 'error');
    }
};

App.prototype.renderAdabirBatchDetails = function(details) {
    const thead = document.getElementById('adabir-details-head');
    const tbody = document.getElementById('adabir-details-body');
    const countEl = document.getElementById('adabir-detail-count');
    
    if (!thead || !tbody) return;
    
    countEl.textContent = details.length.toLocaleString();
    
    if (details.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center">لا توجد سجلات</td></tr>';
        return;
    }

    // Dynamic headers based on first record's rawData
    const sample = details[0].rawData;
    const keys = Object.keys(sample);
    
    thead.innerHTML = `<tr><th>#</th>${keys.map(k => `<th>${k}</th>`).join('')}</tr>`;
    tbody.innerHTML = details.map((d, i) => `
        <tr>
            <td>${i + 1}</td>
            ${keys.map(k => `<td>${d.rawData[k] || ''}</td>`).join('')}
        </tr>
    `).join('');
};

App.prototype.searchAdabirDetails = function(query) {
    if (!this.currentAdabirBatchDetails) return;
    const filtered = this.currentAdabirBatchDetails.filter(d => 
        JSON.stringify(d.rawData).toLowerCase().includes(query.toLowerCase())
    );
    this.renderAdabirBatchDetails(filtered);
};

App.prototype.restoreAdabirBatch = async function(id) {
    if (!confirm('هل أنت متأكد من استعادة هذه الدفعة؟ سيتم إعادتها للجداول النشطة وحذفها من الإضابير.')) return;
    
    try {
        this.showArchiveProgress(50, 'جاري استعادة البيانات...');
        const response = await fetch(`/api/adabir/restore/${id}`, { method: 'POST' });
        const result = await response.json();
        this.showArchiveProgress(100, 'اكتملت الاستعادة');
        
        if (result.success) {
            this.showToast('تمت الاستعادة بنجاح', 'success');
            this.loadAdabirBatches();
        } else {
            this.showToast('فشلت الاستعادة: ' + result.message, 'error');
        }
    } catch (e) {
        this.showToast('خطأ في الاتصال', 'error');
    } finally {
        setTimeout(() => this.hideModal('archive-progress-modal'), 1000);
    }
};
"""

if "App.prototype.loadAdabirBatches" not in content:
    content += "\n\n" + adabir_logic

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done updating app.js")
