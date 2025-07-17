import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import z, { ZodError } from "zod";
import { otp } from "../db/schema/otp.js";
import { notices } from "../db/schema/schema.js";
import { NoticeSchema } from "../types/notice.js";
import { generateStructuredNotice } from "../utils/getStructuredNotice.js";
import { cors } from "hono/cors";
import { structuredNotices } from "../db/schema/structuredNotices.js";
import { StructuredNoticeSchema } from "../types/structuredNotice.js";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
    "*",
    cors({
        origin: "*",
        allowMethods: ["GET", "POST"],
        allowHeaders: ["Content-Type", "Authorization"],
    })
);

// Helper function for date parsing
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

// GET ROUTES

// Get notices
app.get("/notices", async (c) => {
    try {
        const sinceRaw = c.req.query("since") || "01-01-2023 00:00";
        const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
        const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
        const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);

        if (limit <= 0) {
            return c.json({ message: "Limit must be a positive number" }, 400);
        }

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

        // Calculate offset from page if offset not provided
        const calculatedOffset = c.req.query("offset")
            ? offset
            : (page - 1) * limit;

        // Get total count for pagination metadata
        const totalCountResult = await db
            .select({ count: eq(notices.id, notices.id) })
            .from(notices)
            .where(gte(notices.noticeAt, sinceISO));

        const results = await db
            .select()
            .from(notices)
            .where(gte(notices.noticeAt, sinceISO))
            .orderBy(desc(notices.noticeAt))
            .limit(limit)
            .offset(calculatedOffset);

        const totalCount = totalCountResult.length;
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = calculatedOffset + limit < totalCount;
        const hasPreviousPage = calculatedOffset > 0;

        return c.json({
            data: results,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                offset: calculatedOffset,
                hasNextPage,
                hasPreviousPage,
                nextPage: hasNextPage ? page + 1 : null,
                previousPage: hasPreviousPage ? page - 1 : null,
            },
        });
    } catch (error) {
        console.error("Error fetching notices:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});

// Get structured notices
app.get("/structured-notices", async (c) => {
    try {
        const sinceRaw = c.req.query("since") || "01-01-2023 00:00";
        const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
        const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
        const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);

        if (limit <= 0) {
            return c.json({ message: "Limit must be a positive number" }, 400);
        }

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

        // Calculate offset from page if offset not provided
        const calculatedOffset = c.req.query("offset")
            ? offset
            : (page - 1) * limit;

        // Get total count for pagination metadata
        const totalCountResult = await db
            .select({ count: eq(structuredNotices.id, structuredNotices.id) })
            .from(structuredNotices)
            .where(gte(structuredNotices.postedAt, sinceISO));

        const results = await db
            .select()
            .from(structuredNotices)
            .where(gte(structuredNotices.postedAt, sinceISO))
            .orderBy(desc(structuredNotices.postedAt))
            .limit(limit)
            .offset(calculatedOffset);

        const totalCount = totalCountResult.length;
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = calculatedOffset + limit < totalCount;
        const hasPreviousPage = calculatedOffset > 0;

        return c.json({
            data: results,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                offset: calculatedOffset,
                hasNextPage,
                hasPreviousPage,
                nextPage: hasNextPage ? page + 1 : null,
                previousPage: hasPreviousPage ? page - 1 : null,
            },
        });
    } catch (error) {
        console.error("Error fetching structured notices:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});

// Get OTP
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

// POST ROUTES

// Webhook for receiving notices
app.post(
    "/notices/webhook",
    zValidator(
        "json",
        z.array(
            NoticeSchema.pick({
                // id: true,
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

            if (!rawNotices || rawNotices.length === 0) {
                return c.json({ message: "No notices provided" }, 400);
            }

            const db = drizzle(c.env.DB);
            // let processedNotices = 0;
            // let processedStructuredNotices = 0;
            const errors: string[] = [];

            for (const notice of rawNotices) {
                try {
                    const formattedNotice = {
                        type: notice.type,
                        category: notice.category,
                        company: notice.company,
                        noticeAt: parseDDMMYYYYToISO(notice.noticeAt),
                        noticedBy: notice.noticedBy,
                        noticeText: notice.noticeText,
                    };

                    await db.insert(notices).values(formattedNotice);

                    console.log(`Inserted raw notice for ${notice.company}`);

                    try {
                        const structured = await generateStructuredNotice(
                            c.env.GEN_AI_API_KEY,
                            notice
                        );

                        console.log(
                            `Generated structured notice for ${notice.company}:`,
                            JSON.stringify(structured, null, 2)
                        );

                        const formattedStructuredNotice = {
                            company: structured.company,
                            category: structured.category,
                            postedAt: parseDDMMYYYYToISO(notice.noticeAt),
                            deadline: structured.deadline,
                            summary: structured.summary,
                            context: structured.context,
                            actions: structured.actions,
                            pocs: structured.pocs,
                            originalNotice: structured.originalNotice,
                        };

                        await db
                            .insert(structuredNotices)
                            .values(formattedStructuredNotice);

                        console.log(
                            `Inserted structured notice for ${notice.company}`
                        );
                    } catch (structuredError) {
                        console.error(
                            `Failed to generate/insert structured notice for ${notice.company}:`,
                            structuredError
                        );
                        errors.push(
                            `Failed to process structured notice for ${
                                notice.company
                            }: ${
                                structuredError instanceof Error
                                    ? structuredError.message
                                    : "Unknown error"
                            }`
                        );
                    }
                } catch (noticeError) {
                    console.error(
                        `Failed to process notice for ${notice.company}:`,
                        noticeError
                    );
                    errors.push(
                        `Failed to process notice for ${notice.company}: ${
                            noticeError instanceof Error
                                ? noticeError.message
                                : "Unknown error"
                        }`
                    );
                }
            }

            console.log("Webhook processing complete");
            return c.json({
                success: true,
            });
        } catch (error) {
            console.error("Error processing notices webhook:", error);

            if (error instanceof Error) {
                console.error("Error message:", error.message);
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

// Generate structured notice from raw notice
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
        try {
            const rawNotice = c.req.valid("json");

            const structured = await generateStructuredNotice(
                c.env.GEN_AI_API_KEY,
                rawNotice
            );

            console.log(
                "Structured notice generated:",
                JSON.stringify(structured)
            );

            return c.json({ success: true });
        } catch (error) {
            console.error("Error generating structured notice:", error);
            return c.json(
                { success: false, error: (error as Error).message },
                500
            );
        }
    }
);

// Insert structured notices
app.post(
    "/insert-structured-notice",
    zValidator("json", z.array(StructuredNoticeSchema)),
    async (c) => {
        try {
            const structuredNotice = c.req.valid("json");

            const db = drizzle(c.env.DB);

            for (const notice of structuredNotice) {
                console.log("Inserted notice for company:", notice.company);
                await db.insert(structuredNotices).values(notice);
            }

            return c.json({
                message: `${structuredNotice.length} structured notices inserted`,
            });
        } catch (error) {
            // if (error instanceof ZodError) {
            //     const formattedErrors = error.errors.map((err, index) => {
            //         const pathStr = err.path.length > 0 ? err.path.join('.') : 'root';
            //         const isArrayItem = typeof err.path[0] === 'number';
            //         const itemIndex = isArrayItem ? err.path[0] : null;
                    
            //         let message = err.message;
            //         if (itemIndex !== null) {
            //             message = `Item ${itemIndex}: ${message}`;
            //         }
                    
            //         return {
            //             field: pathStr,
            //             message,
            //             code: err.code,
            //             ...(err.code === 'invalid_type' && {
            //                 expected: err.expected,
            //                 received: err.received
            //             }),
            //             ...(itemIndex !== null && { itemIndex })
            //         };
            //     });
                
            //     console.error("Validation errors:", formattedErrors);
            //     return c.json(
            //         {
            //             message: "Validation failed",
            //             errors: formattedErrors,
            //             totalErrors: error.errors.length
            //         },
            //         400
            //     );
            // }

            console.error("Error inserting structured notices:", error);
            return c.json(
                { message: "Failed to insert structured notices" },
                500
            );
        }
    }
);

export default app;
