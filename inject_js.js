const fs = require('fs');

let appJs = fs.readFileSync('wwwroot/js/app.js', 'utf8');

if (!appJs.includes('loadAdabir')) {
    const logic = `
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
                tr.innerHTML = \`
                    <td>\${batch.id}</td>
                    <td>\${batch.archivedAt}</td>
                    <td>\${batch.reason}</td>
                    <td>\${batch.dateFrom} - \${batch.dateTo}</td>
                    <td>\${batch.recordCount}</td>
                    <td>\${batch.sourceTable}</td>
                    <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="\${batch.excelNames}">\${batch.excelNames}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="app.viewAdabirDetails(\${batch.id})">التفاصيل</button>
                        <button class="btn btn-sm btn-danger" onclick="app.restoreAdabir(\${batch.id})">استعادة</button>
                    </td>
                \`;
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
    `;

    const lastBraceIndex = appJs.lastIndexOf('}');
    appJs = appJs.substring(0, lastBraceIndex) + logic + '\n}';
    fs.writeFileSync('wwwroot/js/app.js', appJs, 'utf8');
}

let tasks = fs.readFileSync('specs/014-archives-system/tasks.md', 'utf8');
tasks = tasks.replace(/- \[ \] T007 /g, '- [x] T007 ');
tasks = tasks.replace(/- \[ \] T008 /g, '- [x] T008 ');
tasks = tasks.replace(/- \[ \] T009 /g, '- [x] T009 ');
tasks = tasks.replace(/- \[ \] T011 /g, '- [x] T011 ');
tasks = tasks.replace(/- \[ \] T013 /g, '- [x] T013 ');
tasks = tasks.replace(/- \[ \] T014 /g, '- [x] T014 ');
tasks = tasks.replace(/- \[ \] T017 /g, '- [x] T017 ');
tasks = tasks.replace(/- \[ \] T018 /g, '- [x] T018 ');
tasks = tasks.replace(/- \[ \] T020 /g, '- [x] T020 ');
fs.writeFileSync('specs/014-archives-system/tasks.md', tasks, 'utf8');
console.log("App logic injected and tasks updated.");
