import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix previewBulkArchive to use correct property names
content = content.replace("this.dateFromFilter = from;", "this.uploadDateFrom = from;")
content = content.replace("this.dateToFilter = to;", "this.uploadDateTo = to;")

# Fix toggleBulkArchiveBar to clear correct property names
content = content.replace("this.dateFromFilter = '';", "this.uploadDateFrom = '';")
content = content.replace("this.dateToFilter = '';", "this.uploadDateTo = '';")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed property names in app.js for bulk archive filtering")
