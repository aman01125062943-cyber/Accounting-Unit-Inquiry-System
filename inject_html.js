const fs = require('fs');

let html = fs.readFileSync('wwwroot/index.html', 'utf8');

if (!html.includes('data-page="adabir"')) {
    html = html.replace(/(<a href="#" class="nav-link"\s+data-page="dashboard"[^>]*>[\s\S]*?<\/a>)/i, 
    '$1\n                <a href="#" class="nav-link" data-page="adabir" onclick="if(window.app) window.app.navigateTo(\'adabir\')"><i class="fas fa-archive"></i><span>الأضابير</span></a>');
}

if (!html.includes('id="adabirPage"')) {
    const pageHtml = `
            <!-- Adabir Page -->
            <div id="adabirPage" class="page-section" style="display:none;">
                <div class="page-header">
                    <h2><i class="fas fa-archive"></i> إدارة الأضابير</h2>
                    <div class="header-actions">
                        <button class="btn btn-secondary" onclick="app.loadAdabir()"><i class="fas fa-sync-alt"></i> تحديث</button>
                    </div>
                </div>
                <div class="data-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>رقم الدفعة</th>
                                <th>تاريخ الأرشفة</th>
                                <th>السبب</th>
                                <th>الفترة</th>
                                <th>العدد</th>
                                <th>المصدر</th>
                                <th>الملفات</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="adabir-tbody"></tbody>
                    </table>
                </div>
            </div>
    `;
    html = html.replace(/(<div class="main-content">)/i, '$1\n' + pageHtml);
}

fs.writeFileSync('wwwroot/index.html', html, 'utf8');
console.log("HTML updated.");

// Update tasks.md
let tasks = fs.readFileSync('specs/014-archives-system/tasks.md', 'utf8');
tasks = tasks.replace(/- \[ \] T003 /g, '- [x] T003 ');
tasks = tasks.replace(/- \[ \] T012 /g, '- [x] T012 ');
tasks = tasks.replace(/- \[ \] T016 /g, '- [x] T016 ');
fs.writeFileSync('specs/014-archives-system/tasks.md', tasks, 'utf8');
console.log("tasks.md updated.");
