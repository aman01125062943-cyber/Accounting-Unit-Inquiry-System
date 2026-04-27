const fs = require('fs');
const path = 'c:\\Users\\esth633\\Desktop\\hk\\wwwroot\\index.html';
let content = fs.readFileSync(path, 'utf8');

// Replace for Returns page
const oldReturnsButtons = `<button class="btn-pro-action btn-adabir-pro" onclick="app.archiveToAdabir()" id="btn-adabir-selected" style="display:none; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> حفظ في الاضابير <span id="adabir-selected-count-badge" style="background:#00f0ff; color:#0f172a; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span></button>
                        <button class="btn-pro-action" onclick="app.clearSelectedReturns()" id="btn-clear-selection" style="display:none; background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.1);"><i class="fas fa-times-circle"></i> إلغاء التحديد</button>`;
const newReturnsButtons = `<button class="btn-pro-action btn-adabir-pro" onclick="app.showAdabirArchiveModal('Returns')" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> أرشفة بالمدة</button>`;

if (content.includes('btn-adabir-selected')) {
    content = content.replace(oldReturnsButtons, newReturnsButtons);
    console.log('Returns buttons updated');
}

// Replace for Salary Returns page
const oldSalaryButtons = `<button class="btn-pro-action btn-adabir-pro" onclick="app.archiveToAdabir('salary')" id="btn-salary-adabir-selected" style="display:none; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> حفظ في الاضابير <span id="salary-adabir-selected-count-badge" style="background:#00f0ff; color:#0f172a; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span></button>
                        <button class="btn-pro-action btn-settled-pro" onclick="app.settleSelectedSalaryReturns()" id="btn-salary-settle-selected" style="display:none; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%); border-color: rgba(16, 185, 129, 0.5);"><i class="fas fa-check-double" style="color: #34d399;"></i> تسوية المحدد <span id="salary-settle-selected-count-badge" style="background:#10b981; color:white; border-radius:10px; padding:2px 6px; font-size:12px; margin-right:5px;">0</span></button>`;
const newSalaryButtons = `<button class="btn-pro-action btn-adabir-pro" onclick="app.showAdabirArchiveModal('SalaryReturns')" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);"><i class="fas fa-archive" style="color: #00f0ff;"></i> أرشفة بالمدة</button>`;

if (content.includes('btn-salary-adabir-selected')) {
    content = content.replace(oldSalaryButtons, newSalaryButtons);
    console.log('Salary buttons updated');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Index.html updated successfully');
