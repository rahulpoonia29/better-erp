import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const otp = sqliteTable("otps", {
    roll_no: text("roll_no").primaryKey(),
    otp: integer("otp", { mode: "number" }).notNull(),
    created_at: text("created_at")
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`),
});
