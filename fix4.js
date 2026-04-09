const fs = require('fs');

function robustUserString() {
    return "(window.app?.currentUser?.fullname || window.app?.currentUser?.FullName || window.app?.currentUser?.username || window.auth?.currentUser?.fullname || JSON.parse(localStorage.getItem('returns_session') || '{}')?.fullname || 'مستخدم')";
}

// 1. Fix app.js
const appJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Replace any occurrence of encodeURIComponent(...) with our robust one in attachments
const userRegex = /encodeURIComponent\([^)]+\|\|\s*'مستخدم'\)/g;
appJs = appJs.replace(userRegex, `encodeURIComponent(${robustUserString()})`);
fs.writeFileSync(appJsPath, appJs, 'utf8');

// 2. Fix database.js
const dbJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\database.js';
let dbJs = fs.readFileSync(dbJsPath, 'utf8');

const dbRegex = /encodeURIComponent\(activeUser\.fullname\)/g;
dbJs = dbJs.replace(dbRegex, `encodeURIComponent(${robustUserString()})`);
fs.writeFileSync(dbJsPath, dbJs, 'utf8');

console.log('Applied robust user resolution');
