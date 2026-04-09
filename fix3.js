const fs = require('fs');
const appJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Appending user param to delete attachment fetch
const deleteAttRegex = /await fetch\(`\$\{baseUrl\}\/attachment\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'\s*\}\);/g;
appJs = appJs.replace(deleteAttRegex, "await fetch(`\${baseUrl}/attachment/\${id}?user=\${encodeURIComponent(this.currentUser?.fullname || 'مستخدم')}`, { method: 'DELETE' });");

// Also appending to salary-returns put fetch
const salaryEditRegex = /await fetch\(`\/salary-returns\/\$\{id\}`,\s*\{/g;
appJs = appJs.replace(salaryEditRegex, "await fetch(`/salary-returns/\${id}?user=\${encodeURIComponent(this.currentUser?.fullname || 'مستخدم')}`, {");


fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Fixed more fetch endpoints');
