const fs = require('fs');
const content = fs.readFileSync('c:/Users/esth633/Desktop/hk/wwwroot/js/app.js', 'utf8');

let lines = content.split('\n');
let level = 0;
let inString = null;
let escape = false;
let inComment = false;
let inBlockComment = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let oldLevel = level;
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (inBlockComment) {
            if (char === '*' && line[j + 1] === '/') {
                inBlockComment = false;
                j++;
            }
            continue;
        }
        if (inComment) break;
        if (escape) {
            escape = false;
            continue;
        }
        if (char === '\\') {
            escape = true;
            continue;
        }
        if (inString) {
            if (char === inString) inString = null;
            continue;
        }
        if (char === '/' && line[j + 1] === '/') {
            inComment = true;
            break;
        }
        if (char === '/' && line[j + 1] === '*') {
            inBlockComment = true;
            j++;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            inString = char;
            continue;
        }
        if (char === '{') level++;
        if (char === '}') level--;
    }
    if (level !== oldLevel) {
        // console.log(`Line ${i+1}: level changed to ${level}`);
    }
}
console.log(`Final level: ${level}`);
