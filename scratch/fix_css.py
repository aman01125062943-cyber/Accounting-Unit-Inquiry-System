import sys
import re

chat_path = r'C:\Users\esth633\Desktop\hk\wwwroot\css\chat.css'
with open(chat_path, 'r', encoding='utf-8') as f:
    chat_content = f.read()

chat_content = chat_content.replace('    border-bottom-left: 4px;\n', '')
with open(chat_path, 'w', encoding='utf-8') as f:
    f.write(chat_content)

modern_path = r'C:\Users\esth633\Desktop\hk\wwwroot\css\modern.css'
with open(modern_path, 'r', encoding='utf-8') as f:
    modern_content = f.read()

# Fix base64 issue
# PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSdibGFjayIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==
# ->
# PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJibGFjayIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==
modern_content = modern_content.replace('PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSdibGFjayIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==', 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJibGFjayIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')

# Fix webkit scrollbar warnings
def wrap_in_supports(match):
    return "@supports selector(::-webkit-scrollbar) {\n" + match.group(0) + "\n}"

# We find all ::-webkit-scrollbar blocks and wrap them in @supports
import re

# Simple pattern to match CSS rules with -webkit-scrollbar
# Example: .class::-webkit-scrollbar-thumb { ... }
# Or ::-webkit-scrollbar { ... }
pattern = re.compile(r'([^\}\n]*::-webkit-scrollbar[^\}]*\{[^\}]*\})', re.MULTILINE | re.DOTALL)
matches = pattern.findall(modern_content)

for m in matches:
    # Only wrap if it's not already wrapped
    if '@supports selector' not in m:
        # Note: Need to be careful with nested rules or media queries, but standard css rules don't nest unless using CSS nesting or preprocessors.
        modern_content = modern_content.replace(m, f"@supports selector(::-webkit-scrollbar) {{\n{m}\n}}")

with open(modern_path, 'w', encoding='utf-8') as f:
    f.write(modern_content)

print("Done CSS!")
