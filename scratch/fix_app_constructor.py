import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove from DialogSystem
content = content.replace('class DialogSystem {\n    constructor() {\n        this.selectedReturnIds = new Set();\n        this.isAllReturnsSelected = false;\n', 'class DialogSystem {\n    constructor() {\n')

# 2. Add to App class constructor
if 'this.selectedReturnIds = new Set();' not in content:
    app_constructor_match = re.search(r'class App \{\s+constructor\(\) \{', content)
    if app_constructor_match:
        insertion = "\n        this.selectedReturnIds = new Set();\n        this.isAllReturnsSelected = false;\n"
        content = content[:app_constructor_match.end()] + insertion + content[app_constructor_match.end():]

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("App constructor fixed.")
