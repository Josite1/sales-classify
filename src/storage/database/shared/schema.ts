import { pgTable, serial, varchar, timestamp, jsonb, index, bigint } from "drizzle-orm/pg-core"
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
		data: jsonb("data").notNull(),
		imported_at: bigint("imported_at", { mode: "number" }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("user_records_owner_id_idx").on(table.owner_id),
		index("user_records_record_date_idx").on(table.record_date),
	]
);
