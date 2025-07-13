import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const structuredNotices = sqliteTable("structured_notices", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyName: text("company_name").notNull(),
    noticeTimestamp: text("notice_timestamp").notNull(), // ISO string
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    summary: text("summary").notNull(),
    primaryDeadline: text("primary_deadline"), // ISO string or null
    contextPoints: text("context_points", { mode: "json" }).$type<string[]>(),
    actions: text("actions", { mode: "json" }).notNull().$type<
        {
            type: string;
            title: string;
            details: string;
            isMandatory: boolean;
            eventDetails: {
                startTime: string | null; // ISO
                endTime: string | null; // ISO
                mode: "Online" | "Offline" | "Hybrid" | null;
                link: string | null;
                location: string | null;
            } | null;
        }[]
    >(),
    originalNotice: text("original_notice").notNull(),
});
