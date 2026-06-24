import re
p = "D:/workplace/python/classify_sales/src/app/page.tsx"
with open(p, "r", encoding="utf-8") as f:
    content = f.read()

old = """import {
  loadAllRecords,
  saveAllRecords,
  computeDaySummary,
  getProductTotal,
  loadProductAliases,
  getProductDisplayName,
  syncToCloud,
  fetchFromCloud,
  mergeRecords,
  setActiveUser,
} from '@/lib/store';"""

new = """// Data persistence
import { loadAllRecords, saveAllRecords, loadProductAliases, setActiveUser } from '@/lib/storage';
// Business logic / computation
import { computeDaySummary, getProductTotal, getProductDisplayName } from '@/lib/compute-service';
// Records management & cloud sync
import { syncToCloud, fetchFromCloud, mergeRecords } from '@/lib/records-service';"""

if old in content:
    content = content.replace(old, new)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated imports")
else:
    print("Pattern not found, checking raw content...")
    # Find the import block
    idx = content.find("from '@/lib/store'")
    if idx > 0:
        # Find the start of this import block
        start = content.rfind("import", 0, idx)
        end = idx + len("from '@/lib/store';")
        print(f"Found at position {start}-{end}")
        print("Current block:")
        print(repr(content[start:end]))
    else:
        print("'@/lib/store' not found either")
