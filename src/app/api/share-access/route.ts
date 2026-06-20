import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createHash } from 'crypto';

/** POST /api/share-access — 通过分享码+密码访问分享数据 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shareCode, password } = body as {
      shareCode: string;
      password: string;
    };

    if (!shareCode || !password) {
      return NextResponse.json({ error: '分享码和密码不能为空' }, { status: 400 });
    }

    // 使用 service_role_key 来查询，因为访问者可能不是数据所有者
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('shared_records')
      .select('id, owner_id, share_code, password, title, data, aliases, created_at')
      .eq('share_code', shareCode)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '分享不存在或已过期' }, { status: 404 });
    }

    // 验证密码
    const hashedPassword = createHash('sha256').update(password).digest('hex');
    if (data.password !== hashedPassword) {
      return NextResponse.json({ error: '密码错误' }, { status: 403 });
    }

    // 返回分享数据（不暴露密码哈希）
    return NextResponse.json({
      success: true,
      record: {
        id: data.id,
        title: data.title,
        data: data.data,
        aliases: data.aliases,
        created_at: data.created_at,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
