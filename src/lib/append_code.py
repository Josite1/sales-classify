import os
rest = os.path.join('D:/workplace/python/classify_sales/src/lib/store_remaining.ts')
with open(rest, 'r', encoding='utf-8') as f:
    content = f.read()
with open('D:/workplace/python/classify_sales/src/lib/store.ts', 'a', encoding='utf-8') as f:
    f.write(content)
print('done')
