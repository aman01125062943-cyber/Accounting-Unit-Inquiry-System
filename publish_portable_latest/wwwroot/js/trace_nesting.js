const fs = require('fs');
const content = fs.readFileSync('c:/Users/esth633/Desktop/hk/wwwroot/js/app.js', 'utf8');

let lines = content.split('\n');
let level = 0;
let inString = null;
let escape = false;
let inComment = false;
let inBlockComment = false;

let results = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
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
    results.push({ line: i + 1, level, content: line.trim() });
    inComment = false;
}

// Per-character trace in the suspicious zone
let currentLevel = 0;
let charInString = null;
let charEscape = false;
let charInComment = false;
let charInBlockComment = false;

for (let i = 0; i < content.length; i++) {
    let char = content[i];
    let nextChar = content[i + 1];
    let lineNum = content.substring(0, i).split('\n').length;

    if (charInBlockComment) {
        if (char === '*' && nextChar === '/') { charInBlockComment = false; i++; }
        continue;
    }
    if (charInComment) {
        if (char === '\n') charInComment = false;
        continue;
    }
    if (charEscape) { charEscape = false; continue; }
    if (char === '\\') { charEscape = true; continue; }
    if (charInString) {
        if (char === charInString) charInString = null;
        continue;
    }
    if (char === '/' && nextChar === '/') { charInComment = true; i++; continue; }
    if (char === '/' && nextChar === '*') { charInBlockComment = true; i++; continue; }
    if (char === '"' || char === "'" || char === '`') { charInString = char; continue; }

    if (char === '{') currentLevel++;
    if (char === '}') currentLevel--;

    if (lineNum >= 1 && lineNum <= 150) {
        if (char === '{' || char === '}') {
            console.log(`L${lineNum}: Char "${char}" -> Level ${currentLevel}`);
        }
    }
}

// Print lines where level changes significantly
results.forEach(r => {
    if (r.line < 150) {
        if (r.content === '}' || r.content === '};') {
            console.log(`${r.line}: (lvl ${r.level}) ${r.content}`);
        }
    }
});

console.log(`Final level: ${level}`);
