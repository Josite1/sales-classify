import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 轻量端检查云端记录变更时间戳（~200ms vs ~10s 全量拉取）。
 * 仅查询 user_records 表的 record_date + imported_at，不加载子表。
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) return NextResponse.json({ error: 'Please login first' }, { status: 401 });

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });

  try {
    const { data: records, error: recError } = await client
      .from('user_records')
      .select('record_date, imported_at')
      .eq('owner_id', user.id);

    if (recError) return NextResponse.json({ error: recError.message }, { status: 500 });

    const timestamps: Record<string, number> = {};
    for (const r of records || []) {
      timestamps[r.record_date] = r.imported_at;
    }

    return NextResponse.json({ success: true, timestamps });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Timestamp fetch error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
