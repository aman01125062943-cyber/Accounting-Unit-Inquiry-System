const fs = require('fs');
const path = 'c:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
const content = fs.readFileSync(path, 'utf8').split('\n');
const newContent = content.slice(0, 10637).join('\n');
fs.writeFileSync(path, newContent, 'utf8');
console.log('File trimmed successfully');
