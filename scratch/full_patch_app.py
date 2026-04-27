import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Clean up duplicate constructor entries if any
content = re.sub(r'this\.selectedReturnIds = new Set\(\);\s+this\.isAllReturnsSelected = false;', '', content)
# Add to App constructor
app_constructor_match = re.search(r'class App \{\s+constructor\(\) \{', content)
if app_constructor_match:
    insertion = "\n        this.selectedReturnIds = new Set();\n        this.isAllReturnsSelected = false;\n"
    content = content[:app_constructor_match.end()] + insertion + content[app_constructor_match.end():]

# 2. Define methods
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
        if (headerCheck) headerCheck.checked = false; // "All" is false if we manually toggle
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

# Remove old versions of these methods if they exist
content = re.sub(r'toggleSelectReturn\(id\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'toggleSelectAllReturns\(checked\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'updateBulkDeleteToolbar\(\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'clearSelection\(\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'async bulkDeleteReturns\(\) \{.*?\}', '', content, flags=re.DOTALL)

# Add methods to App class (before renderTable)
render_table_match = re.search(r'renderTable\(dataToRender = null', content)
if render_table_match:
    content = content[:render_table_match.start()] + methods + "\n" + content[render_table_match.start():]

# 3. Update finalOrder in renderTable
# I'll add the checkbox as the first column
content = re.sub(r"const finalOrder = \[", "const finalOrder = [\n                'CHECKBOX',", content)

# 4. Update Header Rendering
header_map_pattern = r'tableHeaders\.innerHTML = finalOrder\.map\(\(h, idx\) => \{'
header_map_match = re.search(header_map_pattern, content)
if header_map_match:
    header_logic = """
            tableHeaders.innerHTML = finalOrder.map((h, idx) => {
                if (h === 'CHECKBOX') {
                    return `<th class="sticky-seq" style="text-align: center !important;"><input type="checkbox" id="select-all-returns" onclick="window.app.toggleSelectAllReturns(this.checked)"></th>`;
                }
"""
    content = re.sub(header_map_pattern, header_logic, content)

# 5. Update Row Rendering
row_map_pattern = r'const cells = \(this\._displayHeaders \|\| this\.headers\)\.map\(\(h, i\) => \{'
row_map_match = re.search(row_map_pattern, content)
if row_map_match:
    row_logic = """
            const cells = (this._displayHeaders || this.headers).map((h, i) => {
                if (h === 'CHECKBOX') {
                    const isChecked = this.isAllReturnsSelected || this.selectedReturnIds.has(String(rowId));
                    return `<td class="sticky-seq col-checkbox" style="text-align: center !important;"><input type="checkbox" class="return-row-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.app.toggleSelectReturn('${rowId}')"></td>`;
                }
"""
    content = re.sub(row_map_pattern, row_logic, content)

# 6. Cleanup old checkbox logic in renderTable
content = re.sub(r'if \(h\.includes\((\'|")<input\1\)\) \{.*?\}', '', content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("App.js fully patched.")
