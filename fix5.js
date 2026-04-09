const fs = require('fs');
const appJsPath = 'C:\\Users\\esth633\\Desktop\\hk\\wwwroot\\js\\app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Fix the SignalR ignored users check:
const ignoreRegex = /if\s*\(\s*this\.currentUser\s*&&\s*user\s*===\s*this\.currentUser\.fullname\s*\)\s*return;/g;

const robustIgnore = `
                const myName = this.currentUser?.fullname || this.currentUser?.FullName || this.currentUser?.username || JSON.parse(localStorage.getItem('returns_session') || '{}')?.fullname || '';
                if (myName && user === myName) return;
`;

appJs = appJs.replace(ignoreRegex, robustIgnore);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Fixed SignalR message filtering logic');
