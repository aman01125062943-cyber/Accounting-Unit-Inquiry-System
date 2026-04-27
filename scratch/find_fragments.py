import sys
import io
import re

app_path = r'C:\Users\esth633\Desktop\hk\wwwroot\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Search for potential broken fragments
# These usually look like dangling HTML strings ending with ">`;" or similar
fragments = re.findall(r'.*?">`;.*', text)
if fragments:
    print("Found potential broken fragments:")
    for f in fragments:
        print(f.strip())
else:
    print("No more broken fragments found.")
