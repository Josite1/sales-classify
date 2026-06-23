export function mergeRecords(a: AllRecords, b: AllRecords): AllRecords {
  const merged = { ...a };
  for (const [date, record] of Object.entries(b)) {
    if (!merged[date] || record.importedAt > merged[date].importedAt) merged[date] = record;
  }
  return merged;
}
