import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Notices table
export const notices = sqliteTable("notices", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    category: text("category").notNull(),
    company: text("company").notNull(),
    noticeAt: text("notice_at").notNull(),
    noticedBy: integer("noticed_by").notNull(),
    noticeText: text("notice_text").notNull(),
});
