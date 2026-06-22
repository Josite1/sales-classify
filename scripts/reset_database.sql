-- =============================================
-- 1. ???????? user_records ? data JSONB ??
-- =============================================
DROP TABLE IF EXISTS user_records CASCADE;

-- =============================================
-- 2. Create shared_records table (if not exists)
-- =============================================
CREATE TABLE IF NOT EXISTS shared_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR(36) NOT NULL,
  share_code VARCHAR(32) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  title VARCHAR(200) NOT NULL,
  data JSONB NOT NULL,
  aliases JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shared_records_owner_id_idx ON shared_records(owner_id);
CREATE INDEX IF NOT EXISTS shared_records_share_code_idx ON shared_records(share_code);

ALTER TABLE shared_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_records_select" ON shared_records;
DROP POLICY IF EXISTS "shared_records_insert" ON shared_records;
DROP POLICY IF EXISTS "shared_records_update" ON shared_records;
DROP POLICY IF EXISTS "shared_records_delete" ON shared_records;

CREATE POLICY "shared_records_select" ON shared_records FOR SELECT USING (true);
CREATE POLICY "shared_records_insert" ON shared_records FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "shared_records_update" ON shared_records FOR UPDATE USING (owner_id = auth.uid()::text);
CREATE POLICY "shared_records_delete" ON shared_records FOR DELETE USING (owner_id = auth.uid()::text);-- =============================================
-- 3. ???? shared_records ??
-- =============================================
ALTER TABLE shared_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_records_select" ON shared_records FOR SELECT USING (true);
CREATE POLICY "shared_records_insert" ON shared_records FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "shared_records_update" ON shared_records FOR UPDATE USING (owner_id = auth.uid()::text);
CREATE POLICY "shared_records_delete" ON shared_records FOR DELETE USING (owner_id = auth.uid()::text);

-- =============================================
-- 4. ???????10 ??????
-- =============================================

-- user_records ????????? JSON ??
CREATE TABLE IF NOT EXISTS user_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR(36) NOT NULL,
  record_date VARCHAR(10) NOT NULL,
  imported_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_records_owner_id_idx ON user_records(owner_id);
CREATE INDEX IF NOT EXISTS user_records_record_date_idx ON user_records(record_date);
CREATE UNIQUE INDEX IF NOT EXISTS user_records_owner_date_unique ON user_records(owner_id, record_date);

-- record_products ?
CREATE TABLE IF NOT EXISTS record_products (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id VARCHAR(36) NOT NULL REFERENCES user_records(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  total INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS record_products_record_id_idx ON record_products(record_id);
CREATE UNIQUE INDEX IF NOT EXISTS record_products_record_product_unique ON record_products(record_id, product_name);

-- product_flags ???????
CREATE TABLE IF NOT EXISTS product_flags (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(36) NOT NULL REFERENCES record_products(id) ON DELETE CASCADE,
  flag_color VARCHAR(20) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_flags_product_id_idx ON product_flags(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_flags_product_color_unique ON product_flags(product_id, flag_color);

-- product_quantity_distributions ???????
CREATE TABLE IF NOT EXISTS product_quantity_distributions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(36) NOT NULL REFERENCES record_products(id) ON DELETE CASCADE,
  flag_color VARCHAR(20) NOT NULL,
  quantity_range VARCHAR(20) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_qty_dist_product_id_idx ON product_quantity_distributions(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_qty_dist_unique ON product_quantity_distributions(product_id, flag_color, quantity_range);

-- product_remark_categories ?????????
CREATE TABLE IF NOT EXISTS product_remark_categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(36) NOT NULL REFERENCES record_products(id) ON DELETE CASCADE,
  flag_color VARCHAR(20) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_remark_cat_product_id_idx ON product_remark_categories(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_remark_cat_unique ON product_remark_categories(product_id, flag_color, category_name);

-- remark_other_details ??"??"?????
CREATE TABLE IF NOT EXISTS remark_other_details (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  remark_category_id VARCHAR(36) NOT NULL REFERENCES product_remark_categories(id) ON DELETE CASCADE,
  order_no VARCHAR(100) NOT NULL,
  product_type VARCHAR(100) DEFAULT '',
  remark_text VARCHAR(500) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS remark_other_details_cat_id_idx ON remark_other_details(remark_category_id);

-- product_province_distributions ???????
CREATE TABLE IF NOT EXISTS product_province_distributions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(36) NOT NULL REFERENCES record_products(id) ON DELETE CASCADE,
  flag_color VARCHAR(20) NOT NULL,
  province VARCHAR(50) NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  town_village_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_province_dist_product_id_idx ON product_province_distributions(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_province_dist_unique ON product_province_distributions(product_id, flag_color, province);

-- product_shop_distributions ???????
CREATE TABLE IF NOT EXISTS product_shop_distributions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(36) NOT NULL REFERENCES record_products(id) ON DELETE CASCADE,
  flag_color VARCHAR(20) NOT NULL,
  shop_name VARCHAR(200) NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_shop_dist_product_id_idx ON product_shop_distributions(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_shop_dist_unique ON product_shop_distributions(product_id, flag_color, shop_name);

-- shop_quantity_distributions ?????????
CREATE TABLE IF NOT EXISTS shop_quantity_distributions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(36) NOT NULL REFERENCES product_shop_distributions(id) ON DELETE CASCADE,
  quantity_range VARCHAR(20) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS shop_qty_dist_shop_id_idx ON shop_quantity_distributions(shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_qty_dist_unique ON shop_quantity_distributions(shop_id, quantity_range);

-- shop_remark_categories ?????????
CREATE TABLE IF NOT EXISTS shop_remark_categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(36) NOT NULL REFERENCES product_shop_distributions(id) ON DELETE CASCADE,
  flag_color VARCHAR(20) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS shop_remark_cat_shop_id_idx ON shop_remark_categories(shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_remark_cat_unique ON shop_remark_categories(shop_id, flag_color, category_name);

-- =============================================
-- 5. RLS ??????
-- =============================================
ALTER TABLE user_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_quantity_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_remark_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE remark_other_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_province_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_shop_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_quantity_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_remark_categories ENABLE ROW LEVEL SECURITY;

-- user_records ??
CREATE POLICY "user_records_select" ON user_records FOR SELECT USING (owner_id = auth.uid()::text);
CREATE POLICY "user_records_insert" ON user_records FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "user_records_update" ON user_records FOR UPDATE USING (owner_id = auth.uid()::text);
CREATE POLICY "user_records_delete" ON user_records FOR DELETE USING (owner_id = auth.uid()::text);

-- record_products ??
CREATE POLICY "record_products_select" ON record_products FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_records WHERE id = record_id AND owner_id = auth.uid()::text)
);
CREATE POLICY "record_products_insert" ON record_products FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_records WHERE id = record_id AND owner_id = auth.uid()::text)
);
CREATE POLICY "record_products_delete" ON record_products FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_records WHERE id = record_id AND owner_id = auth.uid()::text)
);

-- product_flags ??
CREATE POLICY "product_flags_select" ON product_flags FOR SELECT USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_flags_insert" ON product_flags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_flags_delete" ON product_flags FOR DELETE USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);

-- product_quantity_distributions ??
CREATE POLICY "product_qty_dist_select" ON product_quantity_distributions FOR SELECT USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_qty_dist_insert" ON product_quantity_distributions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_qty_dist_delete" ON product_quantity_distributions FOR DELETE USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);

-- product_remark_categories ??
CREATE POLICY "product_remark_cat_select" ON product_remark_categories FOR SELECT USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_remark_cat_insert" ON product_remark_categories FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_remark_cat_delete" ON product_remark_categories FOR DELETE USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);

-- remark_other_details ??
CREATE POLICY "remark_other_select" ON remark_other_details FOR SELECT USING (
  EXISTS (SELECT 1 FROM product_remark_categories prc JOIN record_products rp ON prc.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE prc.id = remark_category_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "remark_other_insert" ON remark_other_details FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM product_remark_categories prc JOIN record_products rp ON prc.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE prc.id = remark_category_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "remark_other_delete" ON remark_other_details FOR DELETE USING (
  EXISTS (SELECT 1 FROM product_remark_categories prc JOIN record_products rp ON prc.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE prc.id = remark_category_id AND ur.owner_id = auth.uid()::text)
);

-- product_province_distributions ??
CREATE POLICY "product_province_select" ON product_province_distributions FOR SELECT USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_province_insert" ON product_province_distributions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_province_delete" ON product_province_distributions FOR DELETE USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);

-- product_shop_distributions ??
CREATE POLICY "product_shop_select" ON product_shop_distributions FOR SELECT USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_shop_insert" ON product_shop_distributions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "product_shop_delete" ON product_shop_distributions FOR DELETE USING (
  EXISTS (SELECT 1 FROM record_products rp JOIN user_records ur ON rp.record_id = ur.id WHERE rp.id = product_id AND ur.owner_id = auth.uid()::text)
);

-- shop_quantity_distributions ??
CREATE POLICY "shop_qty_dist_select" ON shop_quantity_distributions FOR SELECT USING (
  EXISTS (SELECT 1 FROM product_shop_distributions psd JOIN record_products rp ON psd.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE psd.id = shop_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "shop_qty_dist_insert" ON shop_quantity_distributions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM product_shop_distributions psd JOIN record_products rp ON psd.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE psd.id = shop_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "shop_qty_dist_delete" ON shop_quantity_distributions FOR DELETE USING (
  EXISTS (SELECT 1 FROM product_shop_distributions psd JOIN record_products rp ON psd.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE psd.id = shop_id AND ur.owner_id = auth.uid()::text)
);

-- shop_remark_categories ??
CREATE POLICY "shop_remark_cat_select" ON shop_remark_categories FOR SELECT USING (
  EXISTS (SELECT 1 FROM product_shop_distributions psd JOIN record_products rp ON psd.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE psd.id = shop_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "shop_remark_cat_insert" ON shop_remark_categories FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM product_shop_distributions psd JOIN record_products rp ON psd.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE psd.id = shop_id AND ur.owner_id = auth.uid()::text)
);
CREATE POLICY "shop_remark_cat_delete" ON shop_remark_categories FOR DELETE USING (
  EXISTS (SELECT 1 FROM product_shop_distributions psd JOIN record_products rp ON psd.product_id = rp.id JOIN user_records ur ON rp.record_id = ur.id WHERE psd.id = shop_id AND ur.owner_id = auth.uid()::text)
);
