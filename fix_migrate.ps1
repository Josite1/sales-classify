$f = 'D:\workplace\python\classify_sales\src\lib\store.ts'
$c = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)

$old = "export function loadAllRecords(): AllRecords {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}"

$new = "export function loadAllRecords(): AllRecords {
  if (typeof window === 'undefined') return {};
  try {
    const key = getStorageKey();
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    // Anonymous -> user migration
    if (activeUserId) {
      const anonKey = BASE_STORAGE_KEY;
      const anonRaw = localStorage.getItem(anonKey);
      if (anonRaw) {
        const anonData = JSON.parse(anonRaw);
        localStorage.setItem(key, anonRaw);
        localStorage.removeItem(anonKey);
        return anonData;
      }
    }
    return {};
  } catch {
    return {};
  }
}"

$c = $c.Replace($old, $new)

$old2 = "export function loadProductAliases(): ProductAliases {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getAliasKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}"

$new2 = "export function loadProductAliases(): ProductAliases {
  if (typeof window === 'undefined') return {};
  try {
    const key = getAliasKey();
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    // Anonymous -> user migration
    if (activeUserId) {
      const anonKey = BASE_ALIAS_KEY;
      const anonRaw = localStorage.getItem(anonKey);
      if (anonRaw) {
        const anonData = JSON.parse(anonRaw);
        localStorage.setItem(key, anonRaw);
        localStorage.removeItem(anonKey);
        return anonData;
      }
    }
    return {};
  } catch {
    return {};
  }
}"

$c = $c.Replace($old2, $new2)

[System.IO.File]::WriteAllText($f, $c, [System.Text.Encoding]::UTF8)
Write-Output 'store.ts migrated'
