import os
import re

app_path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# Add a line to reset bulk data in manual archive function
app_content = app_content.replace("this.currentArchiveIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));", 
                                  "this.currentArchiveIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));\n    this.currentBulkArchiveData = null;")

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Manual archive logic polished")
