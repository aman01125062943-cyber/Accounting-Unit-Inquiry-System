import sys
import io

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

bad_fragments = [
    'onchange="window.app.updateSelectAllReturns()" style="transform: scale(1.2); cursor: pointer;">`;',
    'onchange="window.app.updateSelectAllSalaryReturns()" style="transform: scale(1.2); cursor: pointer;">`;'
]

new_lines = []
for line in lines:
    is_bad = False
    for frag in bad_fragments:
        if frag in line:
            is_bad = True
            print(f"Removing bad line: {line.strip()}")
            break
    
    if not is_bad:
        new_lines.append(line)

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
