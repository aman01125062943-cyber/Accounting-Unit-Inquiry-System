import sys
import re

file_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init(); 

    // --- Archive System Logic ---
    async loadAdabir() {
        try {
            const res = await fetch('/api/adabir');
            const data = await res.json();
            const tbody = document.getElementById('adabir-tbody');
            if(!tbody) return;
            tbody.innerHTML = '';
            data.forEach(batch => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${batch.id}</td>
                    <td>${batch.archivedAt}</td>
                    <td>${batch.reason}</td>
                    <td>${batch.dateFrom} - ${batch.dateTo}</td>
                    <td>${batch.recordCount}</td>
                    <td>${batch.sourceTable}</td>
                    <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${batch.excelNames}">${batch.excelNames}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="app.viewAdabirDetails(${batch.id})">التفاصيل</button>
                        <button class="btn btn-sm btn-danger" onclick="app.restoreAdabir(${batch.id})">استعادة</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error('Error loading Adabir', e); }
    }

    async viewAdabirDetails(id) {
        try {
            const res = await fetch('/api/adabir/' + id + '/details');
            const details = await res.json();
            console.log("Details loaded:", details);
            alert('تم تحميل ' + details.length + ' سجل. (الواجهة قيد التطوير)');
        } catch(e) { console.error(e); }
    }

    async restoreAdabir(id) {
        if(!confirm('هل أنت متأكد من رغبتك في استعادة هذه الدفعة للجدول الرئيسي؟')) return;
        try {
            const res = await fetch('/api/adabir/restore/' + id, { method: 'POST' });
            if(res.ok) {
                alert('تمت الاستعادة بنجاح');
                this.loadAdabir();
            } else {
                alert('حدث خطأ أثناء الاستعادة');
            }
        } catch(e) { console.error(e); }
    }
    
}"""

replacement = """document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init(); 
});

// --- Archive System Logic ---
App.prototype.loadAdabir = async function() {
    try {
        const res = await fetch('/api/adabir');
        const data = await res.json();
        const tbody = document.getElementById('adabir-tbody');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.forEach(batch => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${batch.id}</td>
                <td>${batch.archivedAt}</td>
                <td>${batch.reason}</td>
                <td>${batch.dateFrom} - ${batch.dateTo}</td>
                <td>${batch.recordCount}</td>
                <td>${batch.sourceTable}</td>
                <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${batch.excelNames}">${batch.excelNames}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.viewAdabirDetails(${batch.id})">التفاصيل</button>
                    <button class="btn btn-sm btn-danger" onclick="app.restoreAdabir(${batch.id})">استعادة</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) { console.error('Error loading Adabir', e); }
};

App.prototype.viewAdabirDetails = async function(id) {
    try {
        const res = await fetch('/api/adabir/' + id + '/details');
        const details = await res.json();
        console.log("Details loaded:", details);
        alert('تم تحميل ' + details.length + ' سجل. (الواجهة قيد التطوير)');
    } catch(e) { console.error(e); }
};

App.prototype.restoreAdabir = async function(id) {
    if(!confirm('هل أنت متأكد من رغبتك في استعادة هذه الدفعة للجدول الرئيسي؟')) return;
    try {
        const res = await fetch('/api/adabir/restore/' + id, { method: 'POST' });
        if(res.ok) {
            alert('تمت الاستعادة بنجاح');
            this.loadAdabir();
        } else {
            alert('حدث خطأ أثناء الاستعادة');
        }
    } catch(e) { console.error(e); }
};"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
else:
    print("Target not found")
