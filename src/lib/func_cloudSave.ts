export async function cloudSaveAllRecords(records: AllRecords, token: string): Promise<{ synced: number }> {
  const res = await fetch('/api/user-records/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session': token }, body: JSON.stringify({ records }) });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '同步失败');
  return { synced: data.synced };
}
