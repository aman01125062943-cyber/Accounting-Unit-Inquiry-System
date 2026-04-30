const fs = require('fs');
const content = fs.readFileSync('c:/Users/esth633/Desktop/hk/wwwroot/js/app.js', 'utf8');

let stack = [];
let lines = content.split('\n');
let inString = null;
let escape = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
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
        if (char === '"' || char === "'" || char === '`') {
            inString = char;
            continue;
        }
        if (char === '{') stack.push({ char, line: i + 1, col: j + 1 });
        if (char === '}') {
            if (stack.length === 0) {
                console.log(`Extra } at line ${i + 1}, col ${j + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log(`Unclosed braces: ${stack.length}`);
    stack.forEach(s => console.log(`Unclosed { at line ${s.line}, col ${s.col}`));
} else {
    console.log('Braces are balanced!');
}
