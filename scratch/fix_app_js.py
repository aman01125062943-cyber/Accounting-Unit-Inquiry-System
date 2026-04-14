import os

file_path = r'c:\Users\esth633\Desktop\hk\wwwroot\js\app.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Indices are 0-based
# Line 3334 -> Index 3333
# Line 3362 -> Index 3361
# Line 3400 -> Index 3399
# Line 3428 -> Index 3427

header_incentive = '                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">كود الملف</th>\n'
header_month = '                                            <th style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; white-space: nowrap;">الشهر المختص</th>\n'

row_batch_code = '                                                <td style="padding: 6px 8px; white-space: nowrap;">${m.batchCode || \'---\'}</td>\n'
row_month = '                                                <td style="padding: 6px 8px; white-space: nowrap;">${m.month || \'---\'}</td>\n'

# Header Incentives
if 'كود الملف' in lines[3333]:
    lines[3333] = header_incentive + header_month

# Row Incentives
if '${m.batchCode' in lines[3361]:
    lines[3361] = row_batch_code + row_month

# Header Salaries
if 'كود الملف' in lines[3399]:
    lines[3399] = header_incentive + header_month

# Row Salaries
if '${m.batchCode' in lines[3427]:
    lines[3427] = row_batch_code + row_month

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Replacement complete.")
