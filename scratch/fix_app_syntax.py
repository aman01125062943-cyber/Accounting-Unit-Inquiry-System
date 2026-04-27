import sys
import io

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

bad_fragment = 'onchange="window.app.updateSelectAllReturns()" style="transform: scale(1.2); cursor: pointer;">`;'
new_lines = []
for line in lines:
    if bad_fragment not in line:
        new_lines.append(line)
    else:
        print(f"Found and removed: {line.strip()}")

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
