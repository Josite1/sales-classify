import re

p = r"D:\workplace\python\classify_sales\src\lib\compute-service.ts"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()

# Export flattenRemarkCounts
c = c.replace("function flattenRemarkCounts", "export function flattenRemarkCounts", 1)

new_fns = """
// ==================== Shop & Quantity helpers ====================

/** Extract count from a shop value that can be number or ShopItem */
export function getShopCount(shopVal: unknown): number {
  if (typeof shopVal === "number") return shopVal;
  if (typeof shopVal === "object" && shopVal !== null) {
    const obj = shopVal as Record<string, unknown>;
    if (typeof obj.count === "number") return obj.count;
    if (typeof obj.count === "string") return parseInt(obj.count, 10) || 0;
  }
  return 0;
}

/** Extract quantity statistics from product data */
export function getProductQtyStats(productData: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  const qtyData = (productData?.["数量分类"] as Record<string, unknown>) ?? {};
  for (const [flag, qtyMap] of Object.entries(qtyData)) {
    if (typeof qtyMap === "object" && qtyMap !== null) {
      for (const [qty, count] of Object.entries(qtyMap as Record<string, unknown>)) {
        if (typeof count === "number") {
          result[flag + "_" + qty] = count;
        }
      }
    }
  }
  return result;
}

/** Extract remark other details for a given flag type */
export function getRemarkOtherDetails(
  productData: Record<string, unknown>,
  flagType: string,
): Record<string, unknown> | null {
  const remarkVal = getRemarkByFlag(productData as any, flagType);
  const otherVal = remarkVal?.["其他"];
  if (typeof otherVal === "object" && otherVal !== null && "明细" in (otherVal as Record<string, unknown>)) {
    return otherVal as Record<string, unknown>;
  }
  return null;
}
"""

# Insert before the last export function
last_export = c.rfind("export function")
if last_export >= 0:
    insert_pos = c.rfind("\n", 0, last_export)
    c = c[:insert_pos] + new_fns + "\n" + c[insert_pos:]
else:
    c += new_fns

with open(p, "w", encoding="utf-8") as f:
    f.write(c)
print("Updated compute-service.ts")
