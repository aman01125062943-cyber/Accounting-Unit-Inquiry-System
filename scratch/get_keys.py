import sqlite3, json
conn = sqlite3.connect('c:/Users/esth633/Desktop/hk/hk.db')
cursor = conn.cursor()
cursor.execute('SELECT RawData FROM Returns LIMIT 100')
rows = cursor.fetchall()
keys = set()
for r in rows:
    keys.update(json.loads(r[0]).keys())

with open('keys.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sorted(keys)))
conn.close()
