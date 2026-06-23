import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { ProductData, RemarkValue, RemarkOtherValue, ShopFlagCategory, ShopItem } from '@/lib/types';

type PostgrestResponse = {
  data: any[] | null;
  error: any;
};

// POST /api/user-records/sync - sync local data to cloud
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: 'Please login first' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { records } = body as {
      records: Record<string, { date: string; data: Record<string, ProductData>; importedAt: number }>;
    };

    if (!records || typeof records !== 'object') {
      return NextResponse.json({ error: 'Invalid record data' }, { status: 400 });
    }

    const dateEntries = Object.entries(records);
    const existingDates = dateEntries.map(([date]) => date);

    for (const [dateStr, record] of dateEntries) {
      const { data: upserted, error: upsertError } = await client
        .from('user_records')
        .upsert(
          { owner_id: user.id, record_date: dateStr, imported_at: record.importedAt },
          { onConflict: 'owner_id,record_date', ignoreDuplicates: false }
        )
        .select('id');

      if (upsertError) {
        console.error('Upsert user_records error:', upsertError.message);
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }

      const recordId = upserted?.[0]?.id;
      if (!recordId) continue;

      const products = record.data || {};

      const { data: existingProducts } = await client
        .from('record_products')
        .select('id, product_name')
        .eq('record_id', recordId);

      const existingProductMap = new Map<string, string>();
      for (const p of (existingProducts || [])) {
        existingProductMap.set(p.product_name, p.id);
      }

      const newProductNames = new Set(Object.keys(products));

      for (const [prodName, prodId] of existingProductMap) {
        if (!newProductNames.has(prodName)) {
          await client.from('record_products').delete().eq('id', prodId);
        }
      }

      for (const [productName, productData] of Object.entries(products)) {
        let productId = existingProductMap.get(productName);

        if (productId) {
          await client.from('record_products').update({ total: productData.total }).eq('id', productId);
          await Promise.all([
            client.from('product_flags').delete().eq('product_id', productId),
            client.from('product_quantity_distributions').delete().eq('product_id', productId),
            client.from('product_remark_categories').delete().eq('product_id', productId),
            client.from('product_province_distributions').delete().eq('product_id', productId),
            client.from('product_shop_distributions').delete().eq('product_id', productId),
          ]);
        } else {
          const { data: newProd } = await client
            .from('record_products')
            .insert({ record_id: recordId, product_name: productName, total: productData.total })
            .select('id') as unknown as PostgrestResponse;
          productId = newProd?.[0]?.id;
          if (!productId) continue;
        }

        // ????
        const flagCounts = productData['\u6807\u65d7\u5206\u7c7b'] || {};
        for (const [flagColor, count] of Object.entries(flagCounts)) {
          if (typeof count === 'number' && count > 0) {
            await client.from('product_flags').insert({
              product_id: productId,
              flag_color: flagColor,
              count,
            });
          }
        }

        // ????
        const qtyDist = productData['\u6570\u91cf\u5206\u7c7b'] || {};
        for (const [flagColor, ranges] of Object.entries(qtyDist)) {
          if (typeof ranges === 'object' && ranges !== null) {
            for (const [range, count] of Object.entries(ranges as Record<string, number>)) {
              if (typeof count === 'number' && count > 0) {
                await client.from('product_quantity_distributions').insert({
                  product_id: productId,
                  flag_color: flagColor,
                  quantity_range: range,
                  count,
                });
              }
            }
          }
        }

        // ??????
        const remarkCat = productData['\u5ba2\u670d\u5907\u6ce8\u5206\u7c7b'] || {};
        for (const [flagColor, categories] of Object.entries(remarkCat)) {
          if (typeof categories === 'object' && categories !== null) {
            for (const [catName, value] of Object.entries(categories as Record<string, unknown>)) {
              const isOther = typeof value === 'object' && value !== null && '\u8ba2\u5355\u6570' in (value as Record<string, unknown>);
              const remarkVal = value as RemarkValue;
              const countVal = isOther ? (remarkVal as RemarkOtherValue)['\u8ba2\u5355\u6570'] : (remarkVal as number);
              if (typeof countVal !== 'number' || countVal <= 0) continue;

              const { data: newCat } = await client
                .from('product_remark_categories')
                .insert({
                  product_id: productId,
                  flag_color: flagColor,
                  category_name: catName,
                  count: countVal,
                })
                .select('id') as unknown as PostgrestResponse;

              const catId = newCat?.[0]?.id;

              if (isOther && catId) {
                const details = (remarkVal as RemarkOtherValue)['\u660e\u7ec6'] || [];
                for (const detail of details) {
                  await client.from('remark_other_details').insert({
                    remark_category_id: catId,
                    order_no: detail['\u8ba2\u5355\u53f7'] || '',
                    product_type: detail['\u54c1\u7c7b'] || '',
                    remark_text: detail['\u5ba2\u670d\u5907\u6ce8'] || '',
                  });
                }
              }
            }
          }
        }

        // ????
        const provDist = productData['\u7701\u4efd\u5206\u7c7b'] || {};
        for (const [flagColor, provinces] of Object.entries(provDist)) {
          if (typeof provinces === 'object' && provinces !== null) {
            for (const [province, info] of Object.entries(provinces as Record<string, { count: number; town_village: number }>)) {
              if (typeof info === 'object' && info !== null && info.count > 0) {
                await client.from('product_province_distributions').insert({
                  product_id: productId,
                  flag_color: flagColor,
                  province,
                  order_count: info.count,
                  town_village_count: info.town_village || 0,
                });
              }
            }
          }
        }

        // ????
        const shopDist = productData['\u5e97\u94fa\u5206\u7c7b'] || {};
        for (const [flagColor, shops] of Object.entries(shopDist)) {
          if (typeof shops === 'object' && shops !== null) {
            for (const [shopName, shopInfo] of Object.entries(shops as Record<string, unknown>)) {
              if (typeof shopInfo !== 'object' || shopInfo === null) continue;
              const shopItem = shopInfo as ShopItem;
              if (!shopItem.count || shopItem.count <= 0) continue;

              const { data: newShop } = await client
                .from('product_shop_distributions')
                .insert({
                  product_id: productId,
                  flag_color: flagColor,
                  shop_name: shopName,
                  order_count: shopItem.count,
                })
                .select('id') as unknown as PostgrestResponse;

              const shopId = newShop?.[0]?.id;
              if (!shopId) continue;

              const shopQty = shopItem['\u6570\u91cf\u5206\u5e03'] || {};
              for (const [range, count] of Object.entries(shopQty)) {
                if (typeof count === 'number' && count > 0) {
                  await client.from('shop_quantity_distributions').insert({
                    shop_id: shopId,
                    quantity_range: range,
                    count,
                  });
                }
              }

              const shopRemark = shopItem['\u5ba2\u670d\u5907\u6ce8\u5206\u7c7b'] || {};
              for (const [sFlagColor, sCategories] of Object.entries(shopRemark)) {
                if (typeof sCategories === 'object' && sCategories !== null) {
                  for (const [sCatName, sCount] of Object.entries(sCategories as unknown as Record<string, unknown>)) {
                    if (typeof sCount === 'number' && sCount > 0) {
                      await client.from('shop_remark_categories').insert({
                        shop_id: shopId,
                        flag_color: sFlagColor,
                        category_name: sCatName,
                        count: sCount,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Delete cloud records that no longer exist locally
    if (existingDates.length > 0) {
      await client
        .from('user_records')
        .delete()
        .eq('owner_id', user.id)
        .not('record_date', 'in', `(${existingDates.join(',')})`);
    } else {
      await client
        .from('user_records')
        .delete()
        .eq('owner_id', user.id);
    }

    return NextResponse.json({ success: true, synced: dateEntries.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function rowsToProductData(
  products: any[],
  flagsMap: Map<string, any[]>,
  qtyMap: Map<string, any[]>,
  remarkMap: Map<string, any[]>,
  otherMap: Map<string, any[]>,
  provMap: Map<string, any[]>,
  shopMap: Map<string, any[]>,
  shopQtyMap: Map<string, any[]>,
  shopRemarkMap: Map<string, any[]>
): Record<string, ProductData> {
  const result: Record<string, ProductData> = {};

  for (const product of products || []) {
    const prodId = product.id;
    const prodName = product.product_name;

    const flags = flagsMap.get(prodId) || [];
    const qties = qtyMap.get(prodId) || [];
    const remarks = remarkMap.get(prodId) || [];
    const provs = provMap.get(prodId) || [];
    const shops = shopMap.get(prodId) || [];

    const flagCounts: Record<string, number> = {};
    for (const f of flags) {
      flagCounts[f.flag_color] = f.count;
    }

    const qtyDist: Record<string, Record<string, number>> = {};
    for (const q of qties) {
      if (!qtyDist[q.flag_color]) qtyDist[q.flag_color] = {};
      qtyDist[q.flag_color][q.quantity_range] = q.count;
    }

    const remarkDist: Record<string, Record<string, unknown>> = {};
    for (const r of remarks) {
      if (!remarkDist[r.flag_color]) remarkDist[r.flag_color] = {};
      const otherDetails = otherMap.get(r.id) || [];
      if (otherDetails.length > 0) {
        remarkDist[r.flag_color][r.category_name] = {
          '\u8ba2\u5355\u6570': r.count,
          '\u660e\u7ec6': otherDetails.map((od: any) => ({
            '\u8ba2\u5355\u53f7': od.order_no,
            '\u54c1\u7c7b': od.product_type,
            '\u5ba2\u670d\u5907\u6ce8': od.remark_text,
          })),
        };
      } else {
        remarkDist[r.flag_color][r.category_name] = r.count;
      }
    }

    const provDist: Record<string, Record<string, { count: number; town_village: number }>> = {};
    for (const p of provs) {
      if (!provDist[p.flag_color]) provDist[p.flag_color] = {};
      provDist[p.flag_color][p.province] = { count: p.order_count, town_village: p.town_village_count };
    }

    const shopDist: Record<string, Record<string, unknown>> = {};
    for (const s of shops) {
      if (!shopDist[s.flag_color]) shopDist[s.flag_color] = {};
      const sQties = shopQtyMap.get(s.id) || [];
      const sRemarks = shopRemarkMap.get(s.id) || [];

      const sQtyDist: Record<string, number> = {};
      for (const sq of sQties) {
        sQtyDist[sq.quantity_range] = sq.count;
      }

      const sRemarkDist: Record<string, Record<string, number>> = {};
      for (const sr of sRemarks) {
        if (!sRemarkDist[sr.flag_color]) sRemarkDist[sr.flag_color] = {};
        sRemarkDist[sr.flag_color][sr.category_name] = sr.count;
      }

      shopDist[s.flag_color][s.shop_name] = {
        count: s.order_count,
        '\u6570\u91cf\u5206\u5e03': sQtyDist,
        '\u5ba2\u670d\u5907\u6ce8\u5206\u7c7b': sRemarkDist,
      };
    }

    result[prodName] = {
      total: product.total,
      '\u6807\u65d7\u5206\u7c7b': flagCounts,
      '\u6570\u91cf\u5206\u7c7b': qtyDist,
      '\u5ba2\u670d\u5907\u6ce8\u5206\u7c7b': remarkDist,
      '\u7701\u4efd\u5206\u7c7b': provDist,
      '\u5e97\u94fa\u5206\u7c7b': shopDist,
    } as unknown as ProductData;
  }

  return result;
}

// GET /api/user-records/sync - fetch data from cloud
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: 'Please login first' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const { data: records, error: recError } = await client
      .from('user_records')
      .select('id, record_date, imported_at')
      .eq('owner_id', user.id)
      .order('record_date', { ascending: true });

    if (recError) {
      return NextResponse.json({ error: recError.message }, { status: 500 });
    }

    const result: Record<string, { date: string; data: Record<string, ProductData>; importedAt: number }> = {};

    for (const record of (records || [])) {
      const recId = record.id;

      const { data: products } = await client
        .from('record_products')
        .select('id, product_name, total')
        .eq('record_id', recId) as unknown as PostgrestResponse;

      const productIds = (products || []).map((p: any) => p.id);

      if (productIds.length === 0) {
        result[record.record_date] = {
          date: record.record_date,
          data: {},
          importedAt: record.imported_at,
        };
        continue;
      }

      const [flagsRes, qtyRes, remarkRes, provRes, shopRes] = await Promise.all([
        client.from('product_flags').select('*').in('product_id', productIds),
        client.from('product_quantity_distributions').select('*').in('product_id', productIds),
        client.from('product_remark_categories').select('*').in('product_id', productIds),
        client.from('product_province_distributions').select('*').in('product_id', productIds),
        client.from('product_shop_distributions').select('*').in('product_id', productIds),
      ]) as unknown as PostgrestResponse[];

      const flagsData = flagsRes.data || [];
      const qtyData = qtyRes.data || [];
      const remarkData = remarkRes.data || [];
      const provData = provRes.data || [];
      const shopData = shopRes.data || [];

      const remarkIds = remarkData.map((r: any) => r.id);
      let otherData: any[] = [];
      if (remarkIds.length > 0) {
        const otherRes = await client
          .from('remark_other_details')
          .select('*')
          .in('remark_category_id', remarkIds) as unknown as PostgrestResponse;
        otherData = otherRes.data || [];
      }

      const shopIds = shopData.map((s: any) => s.id);
      let shopQtyData: any[] = [];
      let shopRemarkData: any[] = [];
      if (shopIds.length > 0) {
        const [sqRes, srRes] = await Promise.all([
          client.from('shop_quantity_distributions').select('*').in('shop_id', shopIds),
          client.from('shop_remark_categories').select('*').in('shop_id', shopIds),
        ]) as unknown as PostgrestResponse[];
        shopQtyData = sqRes.data || [];
        shopRemarkData = srRes.data || [];
      }

      const flagsMap = buildMap(flagsData, 'product_id');
      const qtyMap = buildMap(qtyData, 'product_id');
      const remarkMap = buildMap(remarkData, 'product_id');
      const otherMap = buildMap(otherData, 'remark_category_id');
      const provMap = buildMap(provData, 'product_id');
      const shopMap = buildMap(shopData, 'product_id');
      const shopQtyMap = buildMap(shopQtyData, 'shop_id');
      const shopRemarkMap = buildMap(shopRemarkData, 'shop_id');

      const productData = rowsToProductData(
        products || [],
        flagsMap, qtyMap, remarkMap, otherMap, provMap, shopMap, shopQtyMap, shopRemarkMap
      );

      result[record.record_date] = {
        date: record.record_date,
        data: productData,
        importedAt: record.imported_at,
      };
    }

    return NextResponse.json({ success: true, records: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Fetch error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildMap(data: any[], key: string): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const item of data || []) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}
