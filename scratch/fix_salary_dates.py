import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

salary_date_logic = """
        // Upload Date Logic (Range support)
        if (this.salaryUploadDateFrom || this.salaryUploadDateTo) {
            let rawDate = row['تاريخ الرفع'] || row['UploadDate'] || '';
            if (rawDate) {
                let compareDate = String(rawDate).trim();
                if (compareDate.includes('/')) {
                    const p = compareDate.split(' ')[0].split('/');
                    if (p.length === 3) {
                        if (p[2].length === 4) compareDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                        else if (p[0].length === 4) compareDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                    }
                } else if (compareDate.includes('-')) {
                    const p = compareDate.split(' ')[0].split('-');
                    if (p.length === 3) {
                        if (p[0].length === 4) compareDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                        else if (p[2].length === 4) compareDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                    }
                } else if (compareDate.includes('T')) compareDate = compareDate.split('T')[0];

                if (this.salaryUploadDateFrom && compareDate < this.salaryUploadDateFrom) return false;
                if (this.salaryUploadDateTo && compareDate > this.salaryUploadDateTo) return false;
            } else {
                return false;
            }
        }
"""

# Insert before "return true" in handleLocalSalarySearch
content = content.replace("return true;\n    });", salary_date_logic.strip() + "\n\n        return true;\n    });")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Salary date range logic applied")
