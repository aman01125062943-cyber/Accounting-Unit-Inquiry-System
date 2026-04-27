import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the bad entry from finalOrder
bad_str = "'<input type=\"checkbox\" id=\"select-all-returns\" onclick=\"window.app.toggleSelectAllReturns(this.checked)\">',"
text = text.replace(bad_str, "")

# Ensure only one CHECKBOX is in finalOrder
text = re.sub(r"('CHECKBOX',\s*)+", "'CHECKBOX',\n                ", text)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Final order cleaned up.")
