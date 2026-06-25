// 售后产品数据类型定义

/** 地域分布项 */
export interface RegionItem {
  count: number;
  town_village: number;
}

/** 省份分类项（按旗子颜色分组） */
export interface ProvinceFlagCategory {
  [province: string]: RegionItem;
}

/** 店铺分类项（单个店铺的详细数据） */
export interface ShopItem {
  count: number;
  数量分布: Record<string, number>;
  客服备注分类: Record<string, RemarkValue>;
}

/** 店铺分类项（按旗子颜色分组） */
export type ShopFlagCategory = Record<string, ShopItem | number>;

/** 数量分类值类型（按旗子颜色分组，每个旗子下是 quantity -> count） */
export type QtyFlagCategory = Record<string, Record<string, number>>;

/** 客服备注"其他"明细条目 */
export interface RemarkOtherDetail {
  订单号: string;
  品类: string;
  客服备注: string;
}

/** 客服备注"其他"结构 */
export interface RemarkOtherValue {
  订单数: number;
  明细: RemarkOtherDetail[];
}

/** 客服备注值类型（普通为数字，"其他"为明细对象） */
export type RemarkValue = number | RemarkOtherValue;

/** 客服备注分类（按旗子颜色分组） */
export type RemarkFlagCategory = Record<string, Record<string, RemarkValue>>;

/** 单个产品的数据结构 */
export interface ProductData {
  total: number;
  标旗分类: Record<string, number>;
  数量分类: QtyFlagCategory;
  客服备注分类: RemarkFlagCategory;
  省份分类: Record<string, ProvinceFlagCategory>;
  店铺分类: Record<string, ShopFlagCategory>;
  /** @deprecated 兼容旧数据：flat 数量分类 */
  _qtyFlat?: Record<string, number>;
  /** @deprecated 兼容旧数据 */
  地域分布?: Record<string, RegionItem>;
  /** @deprecated 兼容旧数据 */
  店铺分布?: Record<string, number>;
}

/** 一条日期记录 */
export interface DateRecord {
  date: string; // YYYY-MM-DD
  data: Record<string, ProductData>;
  importedAt: number; // timestamp
}

/** 所有日期记录的集合 */
export interface AllRecords {
  [date: string]: DateRecord;
}

/** 产品别名/备注映射 */
export interface ProductAliases {
  [originalName: string]: {
    alias: string;      // 显示别名
    note: string;       // 备注
  };
}

/** 周汇总数据 */
export interface WeekSummary {
  weekLabel: string; // 如 "2026-W22"
  weekStart: string; // 周一日期
  weekEnd: string; // 周日日期
  totalOrders: number;
  productCount: number;
  products: Record<string, number>; // 产品名 -> 总单数
  redFlags: number;
  topReasons: Record<string, number>; // 客服备注 -> 总数
}

/** 产品趋势数据点 */
export interface ProductTrendPoint {
  weekLabel: string;
  [productName: string]: string | number;
}
