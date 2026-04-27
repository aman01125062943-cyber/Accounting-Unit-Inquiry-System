import os
import re

app_path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# Update confirmArchiveToAdabir to handle both cases
smart_confirm_js = """
App.prototype.confirmArchiveToAdabir = async function() {
    const reasonInput1 = document.getElementById('adabir-reason-input');
    const reason = (reasonInput1?.value || '').trim();
    
    if (!reason || reason.length < 5) {
        this.showToast('السبب قصير جداً (5 أحرف على الأقل)', 'warning');
        return;
    }

    // Case 1: Bulk Archive (Date Range from Inline Bar)
    if (this.currentBulkArchiveData) {
        const data = this.currentBulkArchiveData;
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
            if (result.success) {
                this.showToast('تمت الأرشفة بنجاح', 'success');
                this.hideModal('adabir-reason-modal');
                this.toggleBulkArchiveBar(); // Hide the inline bar
                this.resetAllFilters();
            } else {
                this.showToast('فشل: ' + result.message, 'error');
            }
        } catch (e) {
            this.showToast('خطأ في الاتصال', 'error');
        } finally {
            this.showArchiveProgress(100, 'اكتملت العملية');
            this.currentBulkArchiveData = null; // Reset
            setTimeout(() => this.hideModal('archive-progress-modal'), 1000);
        }
        return;
    }

    // Case 2: Manual Selection (Checkbox)
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
"""

# Replace the existing confirmArchiveToAdabir
app_content = re.sub(r'App\.prototype\.confirmArchiveToAdabir = async function\(.*?\n};', 
                     smart_confirm_js, app_content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Smart confirm function implemented")
