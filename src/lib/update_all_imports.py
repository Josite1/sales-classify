import os, re

src_dir = "D:/workplace/python/classify_sales/src"
files_to_check = []

for root, dirs, files in os.walk(src_dir):
    # Skip node_modules, .next, .venv
    if "node_modules" in root or ".next" in root or ".venv" in root:
        continue
    for f in files:
        if f.endswith((".ts", ".tsx")):
            files_to_check.append(os.path.join(root, f))

# Mapping: store function -> (module, function_name)
STORE_MAP = {
    "setActiveUser": ("storage", "setActiveUser"),
    "loadAllRecords": ("storage", "loadAllRecords"),
    "saveAllRecords": ("storage", "saveAllRecords"),
    "loadProductAliases": ("storage", "loadProductAliases"),
    "saveProductAliases": ("storage", "saveProductAliases"),
    "getProductTotal": ("compute-service", "getProductTotal"),
    "getProductDisplayName": ("compute-service", "getProductDisplayName"),
    "getFlags": ("compute-service", "getFlags"),
    "getFlagCount": ("compute-service", "getFlagCount"),
    "getRedFlagReasons": ("compute-service", "getRedFlagReasons"),
    "getRemarkByFlag": ("compute-service", "getRemarkByFlag"),
    "getRegionDistribution": ("compute-service", "getRegionDistribution"),
    "getShopDistribution": ("compute-service", "getShopDistribution"),
    "validateImportData": ("compute-service", "validateImportData"),
    "parseDirtyJson": ("compute-service", "parseDirtyJson"),
    "computeDaySummary": ("compute-service", "computeDaySummary"),
    "computeAggregatedSummary": ("compute-service", "computeAggregatedSummary"),
    "updateDateRecord": ("records-service", "updateDateRecord"),
    "addDateRecord": ("records-service", "addDateRecord"),
    "removeDateRecord": ("records-service", "removeDateRecord"),
    "setProductAlias": ("records-service", "setProductAlias"),
    "mergeRecords": ("records-service", "mergeRecords"),
    "syncToCloud": ("records-service", "syncToCloud"),
    "fetchFromCloud": ("records-service", "fetchFromCloud"),
}

count = 0
for filepath in files_to_check:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Only process files that import from store
    if "from '@/lib/store'" not in content:
        continue

    # Skip the store.ts file itself
    if filepath.endswith("store.ts"):
        continue

    print(f"Processing: {os.path.relpath(filepath, src_dir)}")
    count += 1

    # Find all imported names from store
    import_match = re.search(r"import\s*\{([^}]+)\}\s*from\s+['\"]@/lib/store['\"]", content)
    if not import_match:
        continue

    imported_names = [name.strip() for name in import_match.group(1).split(",")]

    # Categorize by target module
    storage_imports = []
    compute_imports = []
    records_imports = []
    unknown_imports = []

    for name in imported_names:
        if name in STORE_MAP:
            module_name = STORE_MAP[name][0]
            func_name = STORE_MAP[name][1]
            if module_name == "storage":
                storage_imports.append(func_name)
            elif module_name == "compute-service":
                compute_imports.append(func_name)
            elif module_name == "records-service":
                records_imports.append(func_name)
        else:
            unknown_imports.append(name)

    # Build replacement imports
    new_imports = []
    if storage_imports:
        storage_imports = sorted(set(storage_imports))
        new_imports.append(f"import {{ {', '.join(storage_imports)} }} from '@/lib/storage';")
    if compute_imports:
        compute_imports = sorted(set(compute_imports))
        new_imports.append(f"import {{ {', '.join(compute_imports)} }} from '@/lib/compute-service';")
    if records_imports:
        records_imports = sorted(set(records_imports))
        new_imports.append(f"import {{ {', '.join(records_imports)} }} from '@/lib/records-service';")

    if unknown_imports:
        print(f"  WARNING: Unknown imports still needed from store: {unknown_imports}")
        new_imports.append(f"import {{ {', '.join(unknown_imports)} }} from '@/lib/store';")

    # Replace in content
    old_import = import_match.group(0)
    new_import_text = "\n".join(new_imports)
    content = content.replace(old_import, new_import_text)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Updated imports")

print(f"\nDone. Updated {count} files.")
