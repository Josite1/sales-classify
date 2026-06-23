import { AllRecords } from './types';

export async function cloudLoadAllRecords(token: string): Promise<AllRecords> {
  const res = await fetch('/api/user-records/sync', { method: 'GET', headers: { 'x-session': token } });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'À­È¡Ê§°Ü');
  return data.records as AllRecords;
}
