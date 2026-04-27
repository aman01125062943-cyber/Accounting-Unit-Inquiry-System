import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Constructor
if 'this.selectedReturnIds = new Set();' not in content:
    constructor_match = re.search(r'constructor\(\) \{', content)
    if constructor_match:
        insertion = "\n        this.selectedReturnIds = new Set();\n        this.isAllReturnsSelected = false;\n"
        content = content[:constructor_match.end()] + insertion + content[constructor_match.end():]

# 2. Add Helper Methods & Bulk Delete Logic
methods = """
    toggleSelectReturn(id) {
        if (this.selectedReturnIds.has(id)) {
            this.selectedReturnIds.delete(id);
            this.isAllReturnsSelected = false;
        } else {
            this.selectedReturnIds.add(id);
        }
        this.updateBulkDeleteToolbar();
        
        // Update header checkbox state
        const headerCheck = document.getElementById('select-all-returns');
        if (headerCheck) headerCheck.checked = this.isAllReturnsSelected;
    }

    toggleSelectAllReturns(checked) {
        this.isAllReturnsSelected = checked;
        this.selectedReturnIds.clear();
        
        // Update all visible checkboxes
        const checkboxes = document.querySelectorAll('.return-row-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
        
        this.updateBulkDeleteToolbar();
    }

    updateBulkDeleteToolbar() {
        let toolbar = document.getElementById('bulk-delete-toolbar');
        const count = this.isAllReturnsSelected ? 'الكل (مطابق للفلتر)' : this.selectedReturnIds.size;
        
        if (this.isAllReturnsSelected || this.selectedReturnIds.size > 0) {
            if (!toolbar) {
                toolbar = document.createElement('div');
                toolbar.id = 'bulk-delete-toolbar';
                toolbar.className = 'bulk-toolbar active';
                document.body.appendChild(toolbar);
            }
            toolbar.innerHTML = `
                <div class="bulk-info">
                    <span>تم تحديد: <strong>${count}</strong> سجل</span>
                </div>
                <div class="bulk-actions">
                    <button class="btn btn-danger" onclick="window.app.bulkDeleteReturns()">🗑️ حذف المحدد</button>
                    <button class="btn btn-secondary" onclick="window.app.clearSelection()">✖ إلغاء التحديد</button>
                </div>
            `;
        } else {
            if (toolbar) toolbar.remove();
        }
    }

    clearSelection() {
        this.selectedReturnIds.clear();
        this.isAllReturnsSelected = false;
        const headerCheck = document.getElementById('select-all-returns');
        if (headerCheck) headerCheck.checked = false;
        
        const checkboxes = document.querySelectorAll('.return-row-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        
        this.updateBulkDeleteToolbar();
    }

    async bulkDeleteReturns() {
        const count = this.isAllReturnsSelected ? 'كافة السجلات المطابقة للفلاتر' : this.selectedReturnIds.size + ' سجل';
        if (!confirm(`هل أنت متأكد من رغبتك في حذف ${count}؟ لا يمكن التراجع عن هذه العملية.`)) return;

        try {
            this.showLoading();
            const payload = {
                Ids: Array.from(this.selectedReturnIds).map(id => parseInt(id)),
                DeleteAllFiltered: this.isAllReturnsSelected,
                Search: this.searchQuery,
                Filter: this.filterValue,
                FilterId: this.currentFilterId,
                AttachmentStatus: this.attachmentFilterValue,
                Min: this.minAmount,
                Max: this.maxAmount,
                TargetColumn: this.targetColumn,
                UploadDateFrom: document.getElementById('upload-date-from')?.value,
                UploadDateTo: document.getElementById('upload-date-to')?.value
            };

            const res = await fetch('/api/returns/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const result = await res.json();
                this.showToast(`تم حذف ${result.count} سجل بنجاح`, 'success');
                this.clearSelection();
                this.loadReturns(); // Refresh table
            } else {
                this.showToast('حدث خطأ أثناء الحذف المجمع', 'error');
            }
        } catch (error) {
            console.error('Bulk Delete Error:', error);
            this.showToast('فشل الاتصال بالخادم', 'error');
        } finally {
            this.hideLoading();
        }
    }
"""

if 'toggleSelectReturn' not in content:
    render_table_start = content.find('renderTable(dataToRender = null')
    if render_table_start != -1:
        content = content[:render_table_start] + methods + "\n" + content[render_table_start:]

# 3. Update renderTable Headers
if "'<input type=\"checkbox\" id=\"select-all-returns\"" not in content:
    final_order_match = re.search(r'const finalOrder = \[', content)
    if final_order_match:
        content = content[:final_order_match.end()] + "\n                '<input type=\"checkbox\" id=\"select-all-returns\" onclick=\"window.app.toggleSelectAllReturns(this.checked)\">',\n" + content[final_order_match.end():]

# 4. Handle Checkbox in row rendering
checkbox_logic = """
                if (h.includes('<input')) {
                    const isChecked = this.isAllReturnsSelected || this.selectedReturnIds.has(rowId);
                    val = `<input type="checkbox" class="return-row-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.app.toggleSelectReturn('${rowId}')">`;
                }
"""
if 'class="return-row-checkbox"' not in content:
    cell_loop_start = content.find('finalOrder.map((h, idx) => {', content.find('renderTable'))
    if cell_loop_start != -1:
        # Find the start of the row processing
        row_id_point = content.find('const rowId = String(item.id);', cell_loop_start)
        if row_id_point != -1:
            val_def_point = content.find('let val = item[h] || item[h.toLowerCase()] || "";', row_id_point)
            if val_def_point != -1:
                content = content[:val_def_point] + checkbox_logic + content[val_def_point:]

# 5. Handle Filter Change Detection
if "confirm('لديك سجلات محددة" not in content:
    load_returns_start = content.find('async loadReturns(page = 1')
    if load_returns_start != -1:
        filter_check = """
        if ((this.selectedReturnIds.size > 0 || this.isAllReturnsSelected) && 
            (search !== null && search !== this.searchQuery || filter !== null && filter !== this.filterValue)) {
            if (!confirm('لديك سجلات محددة، هل تريد مسح التحديد أم الإبقاء عليه؟\\n(موافق لمسح التحديد، إلغاء للإبقاء عليه)')) {
                // Keep selection
            } else {
                this.clearSelection();
            }
        }
        """
        brace_pos = content.find('{', load_returns_start)
        content = content[:brace_pos + 1] + filter_check + content[brace_pos + 1:]

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Frontend updated.")
