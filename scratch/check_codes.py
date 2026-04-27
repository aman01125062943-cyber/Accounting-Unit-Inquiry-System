import sqlite3
import os

db_path = r'c:\Users\esth633\Desktop\hk\hk.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT FileCode FROM Returns WHERE FileCode IS NOT NULL LIMIT 20")
    rows = cursor.fetchall()
    for row in rows:
        print(row[0])
    conn.close()
else:
    print("DB not found")
