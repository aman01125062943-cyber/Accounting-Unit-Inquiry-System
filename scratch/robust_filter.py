import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Improved previewBulkArchive to support both Incentive and Salary pages
preview_logic = """
App.prototype.previewBulkArchive = async function() {
    const from = document.getElementById('bulk-archive-from').value;
    const to = document.getElementById('bulk-archive-to').value;
    
    if (!from || !to) return;
    
    // Apply as temporary filters to the table
    if (this.currentPage === 'salary-returns') {
        this.salaryUploadDateFrom = from;
        this.salaryUploadDateTo = to;
        this.loadSalaryReturns();
    } else {
        this.uploadDateFrom = from;
        this.uploadDateTo = to;
        this.loadReturns();
    }
    
    const infoEl = document.getElementById('bulk-archive-preview-info');
    infoEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
    
    try {
        const source = this.currentPage === 'salary-returns' ? 'SalaryReturns' : 'Returns';
        const url = `/api/adabir/preview?sourceTable=${source}&dateFrom=${from}&dateTo=${to}`;
        const response = await fetch(url);
        const result = await response.json();
        
        infoEl.innerHTML = `<i class="fas fa-check-circle"></i> سيتم أرشفة ${result.count.toLocaleString()} سجل`;
    } catch (e) {
        infoEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في المعاينة';
    }
};
"""

toggle_logic = """
App.prototype.toggleBulkArchiveBar = function() {
    const bar = document.getElementById('bulk-archive-filter-bar');
    if (!bar) return;
    
    if (bar.classList.contains('hidden')) {
        bar.classList.remove('hidden');
        bar.style.display = 'flex';
        document.getElementById('bulk-archive-from').value = '';
        document.getElementById('bulk-archive-to').value = '';
        document.getElementById('bulk-archive-preview-info').innerHTML = '<i class="fas fa-info-circle"></i> اختر التاريخ للمعاينة';
    } else {
        bar.classList.add('hidden');
        bar.style.display = 'none';
        
        // Reset filters based on page
        if (this.currentPage === 'salary-returns') {
            this.salaryUploadDateFrom = '';
            this.salaryUploadDateTo = '';
            this.loadSalaryReturns();
        } else {
            this.uploadDateFrom = '';
            this.uploadDateTo = '';
            this.loadReturns();
        }
    }
};
"""

# Replace the functions
content = re.sub(r'App\.prototype\.previewBulkArchive = async function\(.*?\n};', 
                 preview_logic.strip(), content, flags=re.DOTALL)
content = re.sub(r'App\.prototype\.toggleBulkArchiveBar = function\(.*?\n};', 
                 toggle_logic.strip(), content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Robust bulk archive filtering logic implemented")
