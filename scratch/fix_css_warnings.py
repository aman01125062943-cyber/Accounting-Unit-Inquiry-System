import sys
import io
import re

path = r'C:\Users\esth633\Desktop\hk\wwwroot\css\modern.css'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all @supports selector(::-webkit-scrollbar) { ... } blocks
# Note: some blocks might have nested braces, so we need to be careful
def remove_supports_blocks(text):
    pattern = r'@supports selector\(::-webkit-scrollbar\) \{'
    while True:
        match = re.search(pattern, text)
        if not match:
            break
        
        start = match.start()
        brace_count = 0
        end = -1
        for i in range(start + len('@supports selector(::-webkit-scrollbar)'), len(text)):
            if text[i] == '{':
                brace_count += 1
            elif text[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end = i + 1
                    break
        
        if end != -1:
            text = text[:start] + text[end:]
        else:
            break
    return text

content = remove_supports_blocks(content)

# Also remove any stray ::-webkit-scrollbar rules
content = re.sub(r'::-webkit-scrollbar.*?\{.*?\}', '', content, flags=re.S)

# Add standard scrollbar styling at the beginning
standard_scrollbar = """
/* Standard Scrollbar Styling */
* {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
[data-theme='light'] * {
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}
"""
if "/* Standard Scrollbar Styling */" not in content:
    content = standard_scrollbar + "\n" + content

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Scrollbar warnings fixed in modern.css')
