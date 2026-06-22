import { pgTable, serial, varchar, timestamp, integer, bigint, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const sharedRecords = pgTable(
	"shared_records",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		owner_id: varchar("owner_id", { length: 36 }).notNull(),
		share_code: varchar("share_code", { length: 32 }).notNull().unique(),
		password: varchar("password", { length: 255 }).notNull(),
		title: varchar("title", { length: 200 }).notNull(),
		data: jsonb("data").notNull(),
		aliases: jsonb("aliases"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("shared_records_owner_id_idx").on(table.owner_id),
		index("shared_records_share_code_idx").on(table.share_code),
	]
);

export const userRecords = pgTable(
	"user_records",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		owner_id: varchar("owner_id", { length: 36 }).notNull(),
		record_date: varchar("record_date", { length: 10 }).notNull(),
		imported_at: bigint("imported_at", { mode: "number" }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("user_records_owner_id_idx").on(table.owner_id),
		index("user_records_record_date_idx").on(table.record_date),
		uniqueIndex("user_records_owner_date_unique").on(table.owner_id, table.record_date),
	]
);

export const recordProducts = pgTable(
	"record_products",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		record_id: varchar("record_id", { length: 36 }).notNull().references(() => userRecords.id, { onDelete: "cascade" }),
		product_name: varchar("product_name", { length: 200 }).notNull(),
		total: integer("total").notNull().default(0),
	},
	(table) => [
		index("record_products_record_id_idx").on(table.record_id),
		uniqueIndex("record_products_record_product_unique").on(table.record_id, table.product_name),
	]
);

export const productFlags = pgTable(
	"product_flags",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		product_id: varchar("product_id", { length: 36 }).notNull().references(() => recordProducts.id, { onDelete: "cascade" }),
		flag_color: varchar("flag_color", { length: 20 }).notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [
		index("product_flags_product_id_idx").on(table.product_id),
		uniqueIndex("product_flags_product_color_unique").on(table.product_id, table.flag_color),
	]
);

export const productQuantityDistributions = pgTable(
	"product_quantity_distributions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		product_id: varchar("product_id", { length: 36 }).notNull().references(() => recordProducts.id, { onDelete: "cascade" }),
		flag_color: varchar("flag_color", { length: 20 }).notNull(),
		quantity_range: varchar("quantity_range", { length: 20 }).notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [
		index("product_qty_dist_product_id_idx").on(table.product_id),
		uniqueIndex("product_qty_dist_unique").on(table.product_id, table.flag_color, table.quantity_range),
	]
);

export const productRemarkCategories = pgTable(
	"product_remark_categories",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		product_id: varchar("product_id", { length: 36 }).notNull().references(() => recordProducts.id, { onDelete: "cascade" }),
		flag_color: varchar("flag_color", { length: 20 }).notNull(),
		category_name: varchar("category_name", { length: 100 }).notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [
		index("product_remark_cat_product_id_idx").on(table.product_id),
		uniqueIndex("product_remark_cat_unique").on(table.product_id, table.flag_color, table.category_name),
	]
);

export const remarkOtherDetails = pgTable(
	"remark_other_details",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		remark_category_id: varchar("remark_category_id", { length: 36 }).notNull().references(() => productRemarkCategories.id, { onDelete: "cascade" }),
		order_no: varchar("order_no", { length: 100 }).notNull(),
		product_type: varchar("product_type", { length: 100 }).default(""),
		remark_text: varchar("remark_text", { length: 500 }).default(""),
	},
	(table) => [
		index("remark_other_details_cat_id_idx").on(table.remark_category_id),
	]
);

export const productProvinceDistributions = pgTable(
	"product_province_distributions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		product_id: varchar("product_id", { length: 36 }).notNull().references(() => recordProducts.id, { onDelete: "cascade" }),
		flag_color: varchar("flag_color", { length: 20 }).notNull(),
		province: varchar("province", { length: 50 }).notNull(),
		order_count: integer("order_count").notNull().default(0),
		town_village_count: integer("town_village_count").notNull().default(0),
	},
	(table) => [
		index("product_province_dist_product_id_idx").on(table.product_id),
		uniqueIndex("product_province_dist_unique").on(table.product_id, table.flag_color, table.province),
	]
);

export const productShopDistributions = pgTable(
	"product_shop_distributions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		product_id: varchar("product_id", { length: 36 }).notNull().references(() => recordProducts.id, { onDelete: "cascade" }),
		flag_color: varchar("flag_color", { length: 20 }).notNull(),
		shop_name: varchar("shop_name", { length: 200 }).notNull(),
		order_count: integer("order_count").notNull().default(0),
	},
	(table) => [
		index("product_shop_dist_product_id_idx").on(table.product_id),
		uniqueIndex("product_shop_dist_unique").on(table.product_id, table.flag_color, table.shop_name),
	]
);

export const shopQuantityDistributions = pgTable(
	"shop_quantity_distributions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		shop_id: varchar("shop_id", { length: 36 }).notNull().references(() => productShopDistributions.id, { onDelete: "cascade" }),
		quantity_range: varchar("quantity_range", { length: 20 }).notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [
		index("shop_qty_dist_shop_id_idx").on(table.shop_id),
		uniqueIndex("shop_qty_dist_unique").on(table.shop_id, table.quantity_range),
	]
);

export const shopRemarkCategories = pgTable(
	"shop_remark_categories",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		shop_id: varchar("shop_id", { length: 36 }).notNull().references(() => productShopDistributions.id, { onDelete: "cascade" }),
		flag_color: varchar("flag_color", { length: 20 }).notNull(),
		category_name: varchar("category_name", { length: 100 }).notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [
		index("shop_remark_cat_shop_id_idx").on(table.shop_id),
		uniqueIndex("shop_remark_cat_unique").on(table.shop_id, table.flag_color, table.category_name),
	]
);
