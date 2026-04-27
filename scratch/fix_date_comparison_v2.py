import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Enhanced normalization logic with more logging and better date parsing
normalization_logic = """
            // 7. Upload Date Logic
            if (uploadDateFrom || uploadDateTo) {
                let rawDate = row['تاريخ الرفع'] || row['UploadDate'] || '';
                if (!rawDate) return false;

                let compareDate = String(rawDate).trim();
                // Normalize DD/MM/YYYY to YYYY-MM-DD
                if (compareDate.includes('/')) {
                    const p = compareDate.split(' ')[0].split('/');
                    if (p.length === 3) {
                        if (p[2].length === 4) { // DD/MM/YYYY
                            compareDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                        } else if (p[0].length === 4) { // YYYY/MM/DD
                            compareDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                        }
                    }
                } else if (compareDate.includes('-')) {
                    // Could be YYYY-MM-DD or DD-MM-YYYY
                    const p = compareDate.split(' ')[0].split('-');
                    if (p.length === 3) {
                        if (p[0].length === 4) { // YYYY-MM-DD
                            compareDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                        } else if (p[2].length === 4) { // DD-MM-YYYY
                            compareDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                        }
                    }
                } else if (compareDate.includes('T')) {
                    compareDate = compareDate.split('T')[0];
                }

                if (uploadDateFrom && compareDate < uploadDateFrom) return false;
                if (uploadDateTo && compareDate > uploadDateTo) return false;
            }
"""

# Replace the date logic in applyLocalFilters
content = re.sub(r'// 7\. Upload Date Logic.*?if \(uploadDateTo && compareDate > uploadDateTo\) return false;\s+\}', 
                 normalization_logic.strip() + "\n            }", 
                 content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Enhanced date normalization applied")
