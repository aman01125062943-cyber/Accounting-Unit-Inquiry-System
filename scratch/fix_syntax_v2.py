import os

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Triple braces followed by return true
# 1463:             }
# 1464:             }
# 1465:             }
# 1466: 
# 1467:             return true;

bad_code = """            }
            }
            }

            return true;"""

good_code = """            }

            return true;"""

if bad_code in content:
    content = content.replace(bad_code, good_code)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed syntax by direct string replacement")
else:
    print("Pattern not found, checking alternatives...")
    # Try with different whitespace
    bad_code_2 = "}\n            }\n            }\n\n            return true;"
    if bad_code_2 in content:
         content = content.replace(bad_code_2, "}\n\n            return true;")
         with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
         print("Fixed syntax by direct string replacement (v2)")
