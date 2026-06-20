import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { randomBytes, createHash } from 'crypto';

/** POST /api/share — 创建分享 */
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
    const { title, data, aliases, password } = body as {
      title: string;
      data: unknown;
      aliases?: unknown;
      password: string;
    };

    if (!title || !data || !password) {
      return NextResponse.json({ error: '标题、数据和密码不能为空' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: '密码至少4位' }, { status: 400 });
    }

    // 生成分享码
    const shareCode = randomBytes(6).toString('base64url').slice(0, 8);

    // 密码哈希
    const hashedPassword = createHash('sha256').update(password).digest('hex');

    const { data: record, error } = await client
      .from('shared_records')
      .insert({
        owner_id: user.id,
        share_code: shareCode,
        password: hashedPassword,
        title,
        data,
        aliases: aliases || null,
      })
      .select('id, share_code, title, created_at')
      .single();

    if (error) {
      throw new Error(`分享创建失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/share — 获取当前用户的所有分享 */
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

  const { data, error } = await client
    .from('shared_records')
    .select('id, share_code, title, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shares: data });
}

/** PUT /api/share — 更新分享数据（保留原密码） */
export async function PUT(req: NextRequest) {
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
    const { id, data, aliases } = body as {
      id: string;
      data: unknown;
      aliases?: unknown;
    };

    if (!id || !data) {
      return NextResponse.json({ error: '缺少 id 或数据' }, { status: 400 });
    }

    const { data: record, error } = await client
      .from('shared_records')
      .update({ data, aliases: aliases || null })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select('id, share_code, title, created_at')
      .single();

    if (error) {
      throw new Error(`更新失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/share — 重新生成分享码（保留原密码和数据） */
export async function PATCH(req: NextRequest) {
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
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    // 生成新的分享码
    const newShareCode = randomBytes(6).toString('base64url').slice(0, 8);

    const { data: record, error } = await client
      .from('shared_records')
      .update({ share_code: newShareCode })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select('id, share_code, title, created_at')
      .single();

    if (error) {
      throw new Error(`重新生成分享码失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/share?id=xxx — 删除分享 */
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  const { error } = await client
    .from('shared_records')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
