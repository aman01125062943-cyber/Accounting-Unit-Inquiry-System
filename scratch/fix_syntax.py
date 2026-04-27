import os

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove extra braces around line 1464-1465
# 1463:             } (correct for if)
# 1464:             } (extra)
# 1465:             } (extra)
# 1466:             return true; (correct)

# We'll search for the specific pattern of triple braces followed by return true
new_lines = []
skip_next = 0
for i in range(len(lines)):
    if skip_next > 0:
        skip_next -= 1
        continue
    
    if i < len(lines) - 3 and "if (uploadDateTo && compareDate > uploadDateTo) return false;" in lines[i-1] and "}" in lines[i] and "}" in lines[i+1] and "return true;" in lines[i+3]:
         new_lines.append(lines[i]) # Keep one brace
         skip_next = 2 # Skip next two braces
    else:
        new_lines.append(lines[i])

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Syntax error fixed")
