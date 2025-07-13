import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import z from "zod";
import { otp } from "../db/schema/otp.js";
import { notices } from "../db/schema/schema.js";
import { NoticeSchema } from "../types/notice.js";
import { generateStructuredNotice } from "../utils/getStructuredNotice.js";
import { structuredNoticeSchema } from "../types/structured-notice.js";
import { structuredNotices } from "../db/schema/structuredNotices.js";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/notices", async (c) => {
    try {
        const sinceRaw = c.req.query("since") || "01-01-2023 00:00";
        const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100); // Cap at 100

        if (limit <= 0) {
            return c.json({ message: "Limit must be a positive number" }, 400);
        }

        // Convert `sinceRaw` (DD-MM-YYYY HH:mm) → ISO8601
        let sinceISO: string;

        try {
            const match = sinceRaw.match(
                /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/
            );
            if (!match) throw new Error();

            const [, dd, mm, yyyy, hh, min] = match;
            const parsedDate = new Date(
                Date.UTC(
                    parseInt(yyyy),
                    parseInt(mm) - 1,
                    parseInt(dd),
                    parseInt(hh),
                    parseInt(min)
                )
            );

            if (isNaN(parsedDate.getTime())) throw new Error();

            sinceISO = parsedDate.toISOString();
        } catch {
            return c.json(
                {
                    message:
                        "Invalid 'since' date format. Use DD-MM-YYYY HH:mm",
                },
                400
            );
        }

        const db = drizzle(c.env.DB);

        const results = await db
            .select()
            .from(notices)
            .where(gte(notices.noticeAt, sinceISO))
            .orderBy(desc(notices.noticeAt))
            .limit(limit);

        return c.json(results);
    } catch (error) {
        console.error("Error fetching notices:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});

app.post(
    "/notices/webhook",
    zValidator(
        "json",
        z.array(
            NoticeSchema.pick({
                type: true,
                category: true,
                company: true,
                noticeAt: true,
                noticedBy: true,
                noticeText: true,
            })
        )
    ),
    async (c) => {
        try {
            const rawNotices = c.req.valid("json");
            console.log(
                "Received notices webhook with",
                rawNotices.length,
                "notices"
            );

            if (!notices || rawNotices.length === 0) {
                return c.json({ message: "No notices provided" }, 400);
            }

            const formattedNotices = rawNotices.map((notice) => {
                let noticeAtISO: string;

                try {
                    // Parse DD-MM-YYYY HH:mm to ISO
                    const match = notice.noticeAt.match(
                        /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/
                    );
                    if (!match)
                        throw new Error(
                            `Invalid date format: ${notice.noticeAt}`
                        );

                    const [, dd, mm, yyyy, hh, min] = match;

                    const parsedDate = new Date(
                        Date.UTC(
                            parseInt(yyyy),
                            parseInt(mm) - 1, // month is 0-based
                            parseInt(dd),
                            parseInt(hh),
                            parseInt(min)
                        )
                    );

                    if (isNaN(parsedDate.getTime())) {
                        throw new Error(
                            `Invalid parsed date: ${notice.noticeAt}`
                        );
                    }

                    noticeAtISO = parsedDate.toISOString();

                    console.log("The date", noticeAtISO);
                } catch (err) {
                    console.warn(
                        `Failed to parse noticeAt: ${notice.noticeAt}, using current time, the notice ${notice.company}`
                    );
                    noticeAtISO = new Date().toISOString();
                }

                return {
                    type: notice.type,
                    category: notice.category,
                    company: notice.company,
                    noticeAt: noticeAtISO, // ISO8601 string
                    noticedBy: notice.noticedBy,
                    noticeText: notice.noticeText,
                };
            });

            const sortedFormattedNotices = formattedNotices.sort((a, b) => {
                return (
                    new Date(b.noticeAt).getTime() -
                    new Date(a.noticeAt).getTime()
                );
            });

            const db = drizzle(c.env.DB);

            for (const notice of sortedFormattedNotices) {
                await db.insert(notices).values({
                    type: notice.type,
                    category: notice.category,
                    company: notice.company,
                    noticeAt: notice.noticeAt,
                    noticedBy: notice.noticedBy,
                    noticeText: notice.noticeText,
                });
            }

            return c.json({
                message: `${rawNotices.length} notices processed`,
            });
        } catch (error) {
            console.error("Error processing notices webhook:", error);

            if (error instanceof Error) {
                console.error("Error message:", error.message);
                // if Drizzle adds cause, log it
                if ("cause" in error) {
                    console.error("Cause:", (error as any).cause);
                }
                if ("stack" in error) {
                    console.error("Stack:", error.stack);
                }
            }

            return c.json({ message: "Failed to process notices" }, 500);
        }
    }
);

app.post(
    "/structured-notices",
    zValidator(
        "json",
        NoticeSchema.pick({
            type: true,
            category: true,
            company: true,
            noticeAt: true,
            noticedBy: true,
            noticeText: true,
        })
    ),
    async (c) => {
        const rawNotice = c.req.valid("json");

        try {
            // Call LLM to get structured output

            const structured = await generateStructuredNotice(
                c.env.GEN_AI_API_KEY,
                rawNotice
            );

            console.log(
                "Structured notice generated:",
                JSON.stringify(structured)
            );

            // const db = drizzle(c.env.DB);

            // Insert structuredNotice into DB
            // const [noticeRow] = await db
            //     .insert(structuredNotices)
            //     .values({
            //         companyName: structured.companyName,
            //         noticeTimestamp: structured.noticeTimestamp,
            //         tags: structured.tags,
            //         summary: structured.summary,
            //         primaryDeadline: structured.primaryDeadline,
            //         notes: structured.generalInfo,
            //     })
            //     .returning({ id: structuredNotices.id });

            // const structuredNoticeId = noticeRow.id;

            // Insert actions
            // for (const action of structured.actions) {
            //     const [actionRow] = await db
            //         .insert(noticeActions)
            //         .values({
            //             noticeId: structuredNoticeId,
            //             category: action.category,
            //             type: action.type,
            //             title: action.title,
            //             details: action.details,
            //             link: action.link,
            //             isMandatory: action.isMandatory,
            //         })
            //         .returning({ id: noticeActions.id });

            //     const actionId = actionRow.id;

            //     // Insert eventDetails if present
            //     if (action.eventDetails) {
            //         await db.insert(actionEventDetails).values({
            //             actionId,
            //             startTime: action.eventDetails.startTime,
            //             endTime: action.eventDetails.endTime,
            //             mode: action.eventDetails.mode,
            //             link: action.eventDetails.link,
            //             location: action.eventDetails.location,
            //         });
            //     }
            // }

            // return c.json({ success: true, id: structuredNoticeId });
            return c.json({ success: true });
        } catch (error) {
            console.error(error);
            return c.json(
                { success: false, error: (error as Error).message },
                500
            );
        }
    }
);

app.get("/otp/:rollNo", async (c) => {
    try {
        const rollNo = c.req.param("rollNo");
        const requestedAt = c.req.query("requestedAt");

        if (!rollNo) {
            return c.json({ message: "rollNo parameter is required" }, 400);
        }
        if (!requestedAt) {
            return c.json({ message: "requestedAt query param required" }, 400);
        }
        if (isNaN(Date.parse(requestedAt))) {
            return c.json({ message: "Invalid requestedAt date format" }, 400);
        }

        const db = drizzle(c.env.DB);

        const OTP = await db
            .select()
            .from(otp)
            .where(
                and(eq(otp.roll_no, rollNo), gte(otp.created_at, requestedAt))
            )
            .orderBy(otp.created_at)
            .limit(1);

        if (OTP.length === 0) {
            console.log("No OTP found for rollNo:", rollNo);
            return c.json({ message: "No OTP found yet" }, 404);
        }

        return c.json({
            otp: OTP[0].otp,
            createdAt: OTP[0].created_at,
        });
    } catch (error) {
        console.error("Error fetching OTP:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});

app.post(
    "/insert-structured-notice",
    zValidator("json", z.array(structuredNoticeSchema)),
    async (c) => {
        const structuredNotice = c.req.valid("json");

        const formattedStructuredNotice = structuredNotice.map((notice) => {
            return {
                companyName: notice.companyName,
                noticeTimestamp: parseDDMMYYYYToISO(notice.noticeTimestamp),
                tags: notice.tags,
                summary: notice.summary,
                primaryDeadline: parseDDMMYYYYToISO(notice.primaryDeadline!),
                contextPoints: notice.contextPoints,
                actions: notice.actions,
                originalNotice: notice.originalNotice,
            };
        });

        const db = drizzle(c.env.DB);

        for (const notice of formattedStructuredNotice) {
            await db.insert(structuredNotices).values(notice);
        }
    }
);

function parseDDMMYYYYToISO(ddmmyyyyHHMM: string): string {
    if (!ddmmyyyyHHMM) return new Date().toISOString();

    const match = ddmmyyyyHHMM.match(
        /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/
    );
    if (!match) return new Date().toISOString();

    const [, dd, mm, yyyy, hh, min] = match;

    const d = new Date(
        Date.UTC(
            parseInt(yyyy),
            parseInt(mm) - 1,
            parseInt(dd),
            parseInt(hh),
            parseInt(min)
        )
    );

    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export default app;
