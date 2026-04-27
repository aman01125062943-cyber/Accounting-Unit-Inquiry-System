import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize date function to handle DD/MM/YYYY to YYYY-MM-DD
normalization_logic = """
            // 7. Upload Date Logic
            if (uploadDateFrom || uploadDateTo) {
                let uploadDate = row['تاريخ الرفع'] || row['UploadDate'];
                if (!uploadDate) return false;

                // Normalize DD/MM/YYYY to YYYY-MM-DD for comparison
                let compareDate = String(uploadDate);
                if (compareDate.includes('/')) {
                    const p = compareDate.split(' ')[0].split('/');
                    if (p.length === 3) {
                        // Handle DD/MM/YYYY or MM/DD/YYYY - based on screenshot it looks like DD/MM/YYYY
                        // but let's be safe and check year position
                        if (p[2].length === 4) {
                            compareDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                        } else if (p[0].length === 4) {
                            compareDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                        }
                    }
                } else if (compareDate.includes('T')) {
                    compareDate = compareDate.split('T')[0];
                } else {
                    compareDate = compareDate.split(' ')[0];
                }

                if (uploadDateFrom && compareDate < uploadDateFrom) return false;
                if (uploadDateTo && compareDate > uploadDateTo) return false;
            }
"""

# Find the old date logic and replace it
# The old logic starts around line 1431
old_pattern = r'// 7\. Upload Date Logic.*?if \(uploadDateTo\) \{.*?\}'
content = re.sub(r'// 7\. Upload Date Logic.*?if \(uploadDateTo\) \{.*?\}\s+\}', 
                 normalization_logic.strip() + "\n            }", 
                 content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Date normalization applied to local search")
