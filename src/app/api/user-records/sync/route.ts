import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/** POST /api/user-records/sync — 同步本地数据到云端 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { records, aliases } = body as {
      records: Record<string, { date: string; data: unknown; importedAt: number }>;
      aliases?: unknown;
    };

    if (!records || typeof records !== 'object') {
      return NextResponse.json({ error: '无效的记录数据' }, { status: 400 });
    }

    const localDates = Object.keys(records);
    const upserts = Object.entries(records).map(([date, record]) => ({
      owner_id: user.id,
      record_date: date,
      data: record.data,
      imported_at: record.importedAt,
    }));

    // Upsert all records in batches of 50
    let upsertedCount = 0;
    for (let i = 0; i < upserts.length; i += 50) {
      const batch = upserts.slice(i, i + 50);
      const { error } = await client
        .from('user_records')
        .upsert(batch, { onConflict: 'owner_id,record_date' });
      if (error) {
        console.error('Upsert error:', error.message);
        return NextResponse.json({ error: `同步失败: ${error.message}` }, { status: 500 });
      }
      upsertedCount += batch.length;
    }

    // 删除云端中本地已不存在的记录（用户删除了的数据）
    if (localDates.length > 0) {
      const { error: delError } = await client
        .from('user_records')
        .delete()
        .eq('owner_id', user.id)
        .not('record_date', 'in', `(${localDates.join(',')})`);
      if (delError) {
        console.error('Delete stale error:', delError.message);
        // 删除失败不阻塞流程，仅记录日志
      }
    } else {
      // 本地无数据，清空云端该用户所有记录
      const { error: delError } = await client
        .from('user_records')
        .delete()
        .eq('owner_id', user.id);
      if (delError) {
        console.error('Delete all error:', delError.message);
      }
    }

    return NextResponse.json({ success: true, synced: upsertedCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/user-records/sync — 从云端拉取数据 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  try {
    const { data, error } = await client
      .from('user_records')
      .select('record_date, data, imported_at')
      .eq('owner_id', user.id)
      .order('record_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 转换为前端 AllRecords 格式
    const records: Record<string, { date: string; data: unknown; importedAt: number }> = {};
    for (const row of data || []) {
      records[row.record_date] = {
        date: row.record_date,
        data: row.data,
        importedAt: row.imported_at,
      };
    }

    return NextResponse.json({ success: true, records });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
