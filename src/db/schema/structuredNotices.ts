import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const structuredNotices = sqliteTable("structured_notices", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyName: text("company_name").notNull(),
    noticeTimestamp: text("notice_timestamp"), // DD-MM-YYYY HH:MM or null
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    summary: text("summary").notNull(),
    primaryDeadline: text("primary_deadline"), // DD-MM-YYYY HH:MM or null
    generalInfo: text("general_info", { mode: "json" }).$type<string[]>(),
});

export const structuredNoticesRelations = relations(
    structuredNotices,
    ({ many }) => ({
        actions: many(noticeActions),
    })
);

export const noticeActions = sqliteTable("notice_actions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    noticeId: integer("notice_id").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    link: text("link"),
    isMandatory: integer("is_mandatory", { mode: "boolean" }).notNull(),
});

export const noticeActionsRelations = relations(
    noticeActions,
    ({ one, many }) => ({
        structuredNotices: one(structuredNotices, {
            fields: [noticeActions.noticeId],
            references: [structuredNotices.id],
        }),
        eventDetails: many(actionEventDetails),
    })
);

export const actionEventDetails = sqliteTable("action_event_details", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actionId: integer("action_id").references(() => noticeActions.id),
    startTime: text("start_time"),
    endTime: text("end_time"),
    mode: text("mode"), // Online | Offline | Hybrid | null
    link: text("link"),
    location: text("location"),
});

export const actionEventDetailsRelations = relations(
    actionEventDetails,
    ({ one }) => ({
        noticeAction: one(noticeActions, {
            fields: [actionEventDetails.actionId],
            references: [noticeActions.id],
        }),
    })
);
