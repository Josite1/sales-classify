import { AllRecords } from './types';

export async function cloudSaveAllRecords(records: AllRecords, token: string): Promise<{ synced: number }> {
  const res = await fetch('/api/user-records/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session': token }, body: JSON.stringify({ records }) });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Í¬²½Ê§°Ü');
  return { synced: data.synced };
}
