import { zValidator } from "@hono/zod-validator";
import { and, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import z from "zod";
import { otp } from "../db/schema/otp.js";
import { notices } from "../db/schema/schema.js";
import { NoticeSchema } from "../types/notice.js";

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
            const match = sinceRaw.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/);
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
                { message: "Invalid 'since' date format. Use DD-MM-YYYY HH:mm" },
                400
            );
        }

        const db = drizzle(c.env.DB);

        const results = await db
            .select()
            .from(notices)
            .where(gte(notices.noticeAt, sinceISO))
            .orderBy(notices.noticeAt)
            .limit(limit);

        return c.json(results);
    } catch (error) {
        console.error("Error fetching notices:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});


app.post(
    "/notices/webhook",
    zValidator("json", z.array(NoticeSchema.pick({
        type: true,
        category: true,
        company: true,
        noticeAt: true,
        noticedBy: true,
        noticeText: true
    }))),
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
                    if (!match) throw new Error(`Invalid date format: ${notice.noticeAt}`);

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
                        throw new Error(`Invalid parsed date: ${notice.noticeAt}`);
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

            const db = drizzle(c.env.DB);

            const statements = formattedNotices.map(notice => {
                return db.insert(notices).values(notice)
            }
            );

            if (statements.length > 0) {
                await db.batch(statements as [typeof statements[0], ...typeof statements]);
            }

            return c.json({
                message: `${rawNotices.length} notices processed`,
            });
        } catch (error) {
            console.error("Error processing notices webhook:", error);

            if (error instanceof Error) {
                console.error("Error message:", error.message);
                // if Drizzle adds cause, log it
                if ('cause' in error) {
                    console.error("Cause:", (error as any).cause);
                }
                if ('stack' in error) {
                    console.error("Stack:", error.stack);
                }
            }

            return c.json({ message: "Failed to process notices" }, 500);
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

export default app;
