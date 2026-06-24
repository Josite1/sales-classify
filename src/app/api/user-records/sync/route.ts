import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type {
  ProductData,
  RemarkValue,
  RemarkOtherValue,
  RemarkOtherDetail,
  ShopItem,
  ShopFlagCategory,
  ProvinceFlagCategory,
} from '@/lib/types';

// ==================== 辅助函数 ====================
function buildMap(data: any[], key: string): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const item of data || []) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

/**
 * 安全删除产品及其所有关联数据（按层级顺序删除）
 */
async function safeDeleteProducts(
  client: any,
  productIds: string[]
): Promise<void> {
  if (!productIds || productIds.length === 0) return;

  // 第一层：收集需要删除的孙表数据 ID
  const [shopsRes, remarksRes] = await Promise.all([
    client.from('product_shop_distributions').select('id').in('product_id', productIds),
    client.from('product_remark_categories').select('id').in('product_id', productIds),
  ]);

  const shopIds = (shopsRes.data || []).map((s: any) => s.id);
  const remarkIds = (remarksRes.data || []).map((r: any) => r.id);

  // 第二层：删除孙表（shop 的子表和 remark 的子表）
  const deleteGrandChildren: Promise<any>[] = [];
  if (shopIds.length > 0) {
    deleteGrandChildren.push(
      client.from('shop_quantity_distributions').delete().in('shop_id', shopIds),
      client.from('shop_remark_categories').delete().in('shop_id', shopIds),
    );
  }
  if (remarkIds.length > 0) {
    deleteGrandChildren.push(
      client.from('remark_other_details').delete().in('remark_category_id', remarkIds),
    );
  }
  if (deleteGrandChildren.length > 0) {
    await Promise.all(deleteGrandChildren);
  }

  // 第三层：删除直接子表
  await Promise.all([
    client.from('product_flags').delete().in('product_id', productIds),
    client.from('product_quantity_distributions').delete().in('product_id', productIds),
    client.from('product_remark_categories').delete().in('product_id', productIds),
    client.from('product_province_distributions').delete().in('product_id', productIds),
    client.from('product_shop_distributions').delete().in('product_id', productIds),
  ]);

  // 第四层：删除产品主表
  await client.from('record_products').delete().in('id', productIds);
}

/**
 * 安全删除用户记录及其所有关联数据
 */
async function safeDeleteRecords(
  client: any,
  userId: string,
  excludeDates: string[]
): Promise<void> {
  if (excludeDates.length === 0) {
    // 删除所有记录
    const { data: allRecords } = await client
      .from('user_records')
      .select('id')
      .eq('owner_id', userId);

    const recordIds = (allRecords || []).map((r: any) => r.id);

    if (recordIds.length > 0) {
      // 收集所有产品 ID
      const { data: allProducts } = await client
        .from('record_products')
        .select('id')
        .in('record_id', recordIds);

      const productIds = (allProducts || []).map((p: any) => p.id);

      // 删除所有产品及其子数据
      await safeDeleteProducts(client, productIds);

      // 删除记录
      await client.from('user_records').delete().eq('owner_id', userId);
    }
  } else {
    // 查找需要删除的记录
    const { data: recordsToDelete } = await client
      .from('user_records')
      .select('id')
      .eq('owner_id', userId)
      .not('record_date', 'in', excludeDates);

    const recordIdsToDelete = (recordsToDelete || []).map((r: any) => r.id);

    if (recordIdsToDelete.length > 0) {
      // 收集所有产品 ID
      const { data: productsToDelete } = await client
        .from('record_products')
        .select('id')
        .in('record_id', recordIdsToDelete);

      const productIds = (productsToDelete || []).map((p: any) => p.id);

      // 删除所有产品及其子数据
      await safeDeleteProducts(client, productIds);

      // 删除记录
      await client.from('user_records').delete().in('id', recordIdsToDelete);
    }
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

    // 标旗分类
    const flagCounts: Record<string, number> = {};
    for (const f of flags) {
      flagCounts[f.flag_color] = f.count;
    }

    // 数量分类
    const qtyDist: Record<string, Record<string, number>> = {};
    for (const q of qties) {
      if (!qtyDist[q.flag_color]) qtyDist[q.flag_color] = {};
      qtyDist[q.flag_color][q.quantity_range] = q.count;
    }

    // 客服备注分类
    const remarkDist: Record<string, Record<string, RemarkValue>> = {};
    for (const r of remarks) {
      if (!remarkDist[r.flag_color]) remarkDist[r.flag_color] = {};
      const otherDetails = otherMap.get(r.id) || [];
      if (otherDetails.length > 0) {
        remarkDist[r.flag_color][r.category_name] = {
          '订单数': r.count,
          '明细': otherDetails.map((od: any) => ({
            '订单号': od.order_no,
            '品类': od.product_type,
            '客服备注': od.remark_text,
          } as RemarkOtherDetail)),
        } as RemarkOtherValue;
      } else {
        remarkDist[r.flag_color][r.category_name] = r.count;
      }
    }

    // 省份分类
    const provDist: Record<string, ProvinceFlagCategory> = {};
    for (const p of provs) {
      if (!provDist[p.flag_color]) provDist[p.flag_color] = {};
      provDist[p.flag_color][p.province] = {
        count: p.order_count,
        town_village: p.town_village_count,
      };
    }

    // 店铺分类
    const shopDist: Record<string, ShopFlagCategory> = {};
    for (const s of shops) {
      if (!shopDist[s.flag_color]) shopDist[s.flag_color] = {};
      const sQties = shopQtyMap.get(s.id) || [];
      const sRemarks = shopRemarkMap.get(s.id) || [];

      const sQtyDist: Record<string, number> = {};
      for (const sq of sQties) {
        sQtyDist[sq.quantity_range] = sq.count;
      }

      // 构建店铺的客服备注分类，类型为 Record<string, RemarkValue>
      const sRemarkDist: Record<string, RemarkValue> = {};
      for (const sr of sRemarks) {
        sRemarkDist[sr.category_name] = sr.count;
      }

      const shopItem: ShopItem = {
        count: s.order_count,
        '数量分布': sQtyDist,
        '客服备注分类': sRemarkDist,
      };

      shopDist[s.flag_color][s.shop_name] = shopItem;
    }

    result[prodName] = {
      total: product.total,
      '标旗分类': flagCounts,
      '数量分类': qtyDist,
      '客服备注分类': remarkDist,
      '省份分类': provDist,
      '店铺分类': shopDist,
    } as ProductData;
  }

  return result;
}

// ==================== POST 同步上传 ====================
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) return NextResponse.json({ error: 'Please login first' }, { status: 401 });

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });

  try {
    const body = await req.json();
    const { records } = body as {
      records: Record<string, { date: string; data: Record<string, ProductData>; importedAt: number }>;
    };

    if (!records || typeof records !== 'object') {
      return NextResponse.json({ error: 'Invalid record data' }, { status: 400 });
    }

    const dateEntries = Object.entries(records);

    // 并发处理所有日期
    await Promise.all(dateEntries.map(async ([dateStr, record]) => {
      // 1. 插入或更新 user_records 行
      const { data: upserted, error: upsertError } = await client
        .from('user_records')
        .upsert(
          { owner_id: user.id, record_date: dateStr, imported_at: record.importedAt },
          { onConflict: 'owner_id,record_date', ignoreDuplicates: false }
        )
        .select('id');

      if (upsertError) throw new Error(`Upsert record ${dateStr}: ${upsertError.message}`);
      const recordId = upserted?.[0]?.id;
      if (!recordId) return;

      const products = record.data || {};

      // 2. 获取当前记录下已有产品
      const { data: existingProducts } = await client
        .from('record_products')
        .select('id, product_name')
        .eq('record_id', recordId);

      const nameToIdMap = new Map<string, string>();
      const idToNameMap = new Map<string, string>();
      for (const p of existingProducts || []) {
        nameToIdMap.set(p.product_name, p.id);
        idToNameMap.set(p.id, p.product_name);
      }

      const newProductNames = new Set(Object.keys(products));

      // 3. 删除不再需要的产品（使用安全删除函数）
      const productsToDelete = Array.from(nameToIdMap.entries())
        .filter(([name]) => !newProductNames.has(name))
        .map(([, id]) => id);

      if (productsToDelete.length > 0) {
        await safeDeleteProducts(client, productsToDelete);
      }

      // 4. 更新已存在产品的 total
      const updateProductIds: string[] = [];
      for (const [prodName, prodId] of nameToIdMap) {
        if (newProductNames.has(prodName)) {
          updateProductIds.push(prodId);
          await client.from('record_products').update({ total: products[prodName].total }).eq('id', prodId);
        }
      }

      // 5. 批量插入新产品
      const newProductRows = Array.from(newProductNames)
        .filter(name => !nameToIdMap.has(name))
        .map(name => ({
          record_id: recordId,
          product_name: name,
          total: products[name].total,
        }));

      let newProductList: { id: string; product_name: string }[] = [];
      if (newProductRows.length > 0) {
        const { data: inserted } = await client
          .from('record_products')
          .insert(newProductRows)
          .select('id, product_name');
        newProductList = inserted || [];
      }

      // 6. 构建所有需要重建子表的产品列表
      const allProductItems: { id: string; data: ProductData }[] = [];

      for (const id of updateProductIds) {
        const name = idToNameMap.get(id);
        if (name && products[name]) {
          allProductItems.push({ id, data: products[name] });
        }
      }
      for (const np of newProductList) {
        if (products[np.product_name]) {
          allProductItems.push({ id: np.id, data: products[np.product_name] });
        }
      }

      // 7. 清理这些产品的所有子表数据（使用安全删除函数）
      const allTargetProductIds = allProductItems.map(p => p.id);
      if (allTargetProductIds.length > 0) {
        await safeDeleteProducts(client, allTargetProductIds);
      }

      // 8. 收集所有待插入数据
      const flagsInsert: any[] = [];
      const qtyInsert: any[] = [];
      const remarkInsert: any[] = [];
      const provInsert: any[] = [];
      const shopInsert: any[] = [];

      for (const { id: prodId, data } of allProductItems) {
        // 标旗分类
        const flagCounts = data['标旗分类'] || {};
        for (const [flagColor, count] of Object.entries(flagCounts)) {
          if (typeof count === 'number' && count > 0) {
            flagsInsert.push({ product_id: prodId, flag_color: flagColor, count });
          }
        }

        // 数量分类
        const qtyDist = data['数量分类'] || {};
        for (const [flagColor, ranges] of Object.entries(qtyDist)) {
          if (typeof ranges === 'object' && ranges !== null) {
            for (const [range, count] of Object.entries(ranges as Record<string, number>)) {
              if (typeof count === 'number' && count > 0) {
                qtyInsert.push({ product_id: prodId, flag_color: flagColor, quantity_range: range, count });
              }
            }
          }
        }

        // 客服备注分类（带明细）
        const remarkCat = data['客服备注分类'] || {};
        for (const [flagColor, categories] of Object.entries(remarkCat)) {
          if (typeof categories === 'object' && categories !== null) {
            for (const [catName, value] of Object.entries(categories as Record<string, RemarkValue>)) {
              const isOther = typeof value === 'object' && value !== null && '订单数' in value;
              const countVal = isOther ? (value as RemarkOtherValue)['订单数'] : value;
              if (typeof countVal !== 'number' || countVal <= 0) continue;

              remarkInsert.push({
                product_id: prodId,
                flag_color: flagColor,
                category_name: catName,
                count: countVal,
                _tempOther: isOther ? (value as RemarkOtherValue)['明细'] || [] : null,
              });
            }
          }
        }

        // 省份分类
        const provDist = data['省份分类'] || {};
        for (const [flagColor, provinces] of Object.entries(provDist)) {
          if (typeof provinces === 'object' && provinces !== null) {
            for (const [province, info] of Object.entries(provinces)) {
              if (typeof info === 'object' && info !== null && info.count > 0) {
                provInsert.push({
                  product_id: prodId,
                  flag_color: flagColor,
                  province,
                  order_count: info.count,
                  town_village_count: info.town_village || 0,
                });
              }
            }
          }
        }

        // 店铺分类（带子表）
        const shopDist = data['店铺分类'] || {};
        for (const [flagColor, shops] of Object.entries(shopDist)) {
          if (typeof shops === 'object' && shops !== null) {
            for (const [shopName, shopInfo] of Object.entries(shops)) {
              if (typeof shopInfo !== 'object' || shopInfo === null) continue;
              const shopItem = shopInfo as ShopItem;
              if (!shopItem.count || shopItem.count <= 0) continue;

              shopInsert.push({
                product_id: prodId,
                flag_color: flagColor,
                shop_name: shopName,
                order_count: shopItem.count,
                _tempShopQty: shopItem['数量分布'] || {},
                _tempShopRemark: shopItem['客服备注分类'] || {},
              });
            }
          }
        }
      }

      // 9. 批量插入不依赖外键的子表
      await Promise.all([
        flagsInsert.length && client.from('product_flags').insert(flagsInsert),
        qtyInsert.length && client.from('product_quantity_distributions').insert(qtyInsert),
        provInsert.length && client.from('product_province_distributions').insert(provInsert),
      ].filter(Boolean));

      // 10. 处理备注分类 → 关联 other details
      if (remarkInsert.length > 0) {
        const cleanRemarks = remarkInsert.map(({ _tempOther, ...rest }) => rest);
        const { data: insertedRemarks } = await client
          .from('product_remark_categories')
          .insert(cleanRemarks)
          .select('id');

        if (insertedRemarks) {
          const otherInsert: any[] = [];
          for (let i = 0; i < insertedRemarks.length; i++) {
            const original = remarkInsert[i];
            if (original._tempOther && original._tempOther.length > 0) {
              const catId = insertedRemarks[i].id;
              for (const detail of original._tempOther) {
                otherInsert.push({
                  remark_category_id: catId,
                  order_no: detail['订单号'] || '',
                  product_type: detail['品类'] || '',
                  remark_text: detail['客服备注'] || '',
                });
              }
            }
          }
          if (otherInsert.length > 0) {
            await client.from('remark_other_details').insert(otherInsert);
          }
        }
      }

      // 11. 处理店铺 → 关联数量分布、备注分类
      if (shopInsert.length > 0) {
        const cleanShops = shopInsert.map(({ _tempShopQty, _tempShopRemark, ...rest }) => rest);
        const { data: insertedShops } = await client
          .from('product_shop_distributions')
          .insert(cleanShops)
          .select('id');

        if (insertedShops) {
          const shopQtyInsert: any[] = [];
          const shopRemarkInsert: any[] = [];
          for (let i = 0; i < insertedShops.length; i++) {
            const shopId = insertedShops[i].id;
            const original = shopInsert[i];

            for (const [range, count] of Object.entries(original._tempShopQty)) {
              if (typeof count === 'number' && count > 0) {
                shopQtyInsert.push({ shop_id: shopId, quantity_range: range, count });
              }
            }

            // _tempShopRemark 类型是 Record<string, RemarkValue>
            const shopRemark = original._tempShopRemark as Record<string, RemarkValue>;
            for (const [sCatName, sCount] of Object.entries(shopRemark)) {
              if (typeof sCount === 'number' && sCount > 0) {
                shopRemarkInsert.push({ shop_id: shopId, flag_color: '', category_name: sCatName, count: sCount });
              }
            }
          }
          await Promise.all([
            shopQtyInsert.length && client.from('shop_quantity_distributions').insert(shopQtyInsert),
            shopRemarkInsert.length && client.from('shop_remark_categories').insert(shopRemarkInsert),
          ].filter(Boolean));
        }
      }
    }));

    // ---------- 删除云端不再存在的日期记录 ----------
    const allLocalDates = dateEntries.map(([date]) => date);
    await safeDeleteRecords(client, user.id, allLocalDates);

    return NextResponse.json({ success: true, synced: dateEntries.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ==================== GET 拉取同步 ====================
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) return NextResponse.json({ error: 'Please login first' }, { status: 401 });

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });

  try {
    // 1. 获取该用户所有记录
    const { data: records, error: recError } = await client
      .from('user_records')
      .select('id, record_date, imported_at')
      .eq('owner_id', user.id);

    if (recError) return NextResponse.json({ error: recError.message }, { status: 500 });
    if (!records || records.length === 0) {
      return NextResponse.json({ success: true, records: {} });
    }

    const recordIds = records.map(r => r.id);

    // 2. 一次获取所有产品
    const { data: products } = await client
      .from('record_products')
      .select('*')
      .in('record_id', recordIds);

    const productIds = (products || []).map(p => p.id);

    if (productIds.length === 0) {
      const result: Record<string, { date: string; data: Record<string, ProductData>; importedAt: number }> = {};
      for (const r of records) {
        result[r.record_date] = { date: r.record_date, data: {}, importedAt: r.imported_at };
      }
      return NextResponse.json({ success: true, records: result });
    }

    // 3. 一次性获取所有子表数据
    const [
      { data: flags },
      { data: qties },
      { data: remarks },
      { data: provs },
      { data: shops },
    ] = await Promise.all([
      client.from('product_flags').select('*').in('product_id', productIds),
      client.from('product_quantity_distributions').select('*').in('product_id', productIds),
      client.from('product_remark_categories').select('*').in('product_id', productIds),
      client.from('product_province_distributions').select('*').in('product_id', productIds),
      client.from('product_shop_distributions').select('*').in('product_id', productIds),
    ]);

    const remarkIds = (remarks || []).map((r: any) => r.id);
    const shopIds = (shops || []).map((s: any) => s.id);

    const [
      { data: otherDetails },
      { data: shopQties },
      { data: shopRemarks },
    ] = await Promise.all([
      remarkIds.length
        ? client.from('remark_other_details').select('*').in('remark_category_id', remarkIds)
        : Promise.resolve({ data: [] }),
      shopIds.length
        ? client.from('shop_quantity_distributions').select('*').in('shop_id', shopIds)
        : Promise.resolve({ data: [] }),
      shopIds.length
        ? client.from('shop_remark_categories').select('*').in('shop_id', shopIds)
        : Promise.resolve({ data: [] }),
    ]);

    // 4. 内存分组
    const flagsMap = buildMap(flags || [], 'product_id');
    const qtyMap = buildMap(qties || [], 'product_id');
    const remarkMap = buildMap(remarks || [], 'product_id');
    const otherMap = buildMap(otherDetails || [], 'remark_category_id');
    const provMap = buildMap(provs || [], 'product_id');
    const shopMap = buildMap(shops || [], 'product_id');
    const shopQtyMap = buildMap(shopQties || [], 'shop_id');
    const shopRemarkMap = buildMap(shopRemarks || [], 'shop_id');

    // 5. 按日期构建返回结果
    const result: Record<string, { date: string; data: Record<string, ProductData>; importedAt: number }> = {};
    for (const record of records) {
      const recProducts = (products || []).filter(p => p.record_id === record.id);
      result[record.record_date] = {
        date: record.record_date,
        data: rowsToProductData(
          recProducts,
          flagsMap, qtyMap, remarkMap, otherMap, provMap, shopMap, shopQtyMap, shopRemarkMap
        ),
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