import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const structuredNotices = sqliteTable("structured_notices", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    company: text("company").notNull(),
    category: text("category")
        .notNull()
        .$type<
            | "CV_SUBMISSION"
            | "DATE_EXTENSION"
            | "PPT/WORKSHOP"
            | "SHORTLIST"
            | "GENERAL"
        >(),
    postedAt: text("posted_at").notNull(), // ISO string
    deadline: text("deadline").notNull(), // ISO string
    summary: text("summary").notNull(),
    // tags: text("tags", { mode: "json" }).$type<string[]>(),
    context: text("context", { mode: "json" }).$type<string[]>().notNull(),
    actions: text("actions", { mode: "json" }).notNull().$type<
        {
            type: "CV_SUBMISSION" | "ATTEND_EVENT" | "FILL_FORM" | "OTHER";
            title: string;
            details: string;
            mandatory: boolean;
            event: {
                at: string; // ISO
                location: string;
                link: string;
                mode: "Online" | "Offline" | "Hybrid" | "null";
            };
        }[]
    >(),
    pocs: text("pocs", { mode: "json" }).notNull().$type<
        {
            name: string;
            contact: string;
        }[]
    >(),
    originalNotice: text("original_notice").notNull(),
});
