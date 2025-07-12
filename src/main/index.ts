import { Hono } from "hono";
import { NoticeSchema, type Notice } from "../types/notice.js";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { AuthCredantialsSchema } from "../types/session.js";
import axios from "axios";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/notices", async (c) => {
    try {
        const since = c.req.query("since") || "01-01-2023 00:00";
        console.log("Fetching notices since:", since);

        const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100); // Cap at 100

        // Validate date format using regex: DD-MM-YYYY HH:MM
        const dateRegex = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/;
        if (!dateRegex.test(since)) {
            return c.json({ message: "Invalid 'since' date format. Expected DD-MM-YYYY HH:MM" }, 400);
        }

        if (limit <= 0) {
            return c.json({ message: "Limit must be a positive number" }, 400);
        }

        // console.log(`SELECT * FROM notices WHERE notice_at > ${since} ORDER BY notice_at DESC LIMIT ${limit}`);

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM notices WHERE notice_at > ? ORDER BY notice_at DESC LIMIT ?`
        )
            .bind(since, limit)
            .all();

        return c.json(results || []);
    } catch (error) {
        console.error("Error fetching notices:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});

app.post(
    "/scrape-notices",
    zValidator("json", AuthCredantialsSchema),
    async (c) => {
        try {
            const data = c.req.valid("json");

            // Security: Check API key in Authorization header
            const authHeader = c.req.header("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return c.json(
                    { message: "Missing or invalid Authorization header" },
                    401
                );
            }

            const apiKey = authHeader.replace("Bearer ", "");
            if (!apiKey || apiKey !== c.env.API_KEY) {
                return c.json({ message: "Invalid API key" }, 403);
            }

            const res = await c.env.DB.prepare(
                `SELECT MAX(notice_at) as lastNoticeAt FROM notices`
            ).first<{ lastNoticeAt: string | null }>();

            console.log("Last notice date:", res?.lastNoticeAt);

            const lastNoticeAt = res?.lastNoticeAt || "01-01-2023 00:00";

            if (!c.env.SCRAPER_API_URL) {
                return c.json({ message: "SCRAPER_API_URL not configured" }, 500);
            }

            // Trigger the scraper by calling its API
            await axios.post<{
                message: string;

            }>(
                `${c.env.SCRAPER_API_URL}/scrape-notices`,
                {
                    ...data,
                    lastKnownNoticeAt: lastNoticeAt,
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            ).then((res) => res.data).catch((error) => {
                console.error("Error calling scraper API:", error);
                throw new Error("Failed to trigger scraper API");
            })

            return c.json({
                message: "Scraper triggered successfully",
                lastNoticeAt,
            });
        } catch (error) {
            console.error("Error in scrape-notices endpoint:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return c.json({ message: "Internal server error", errorMessage }, 500);
        }
    }
);

app.post(
    "/notices/webhook",
    zValidator("json", z.array(NoticeSchema)),
    async (c) => {
        try {
            const notices = c.req.valid("json");

            console.log("Received notices webhook with", notices.length, "notices");

            if (!notices || notices.length === 0) {
                return c.json({ message: "No notices provided" }, 400);
            }

            const stmt = c.env.DB.prepare(
                `INSERT OR IGNORE INTO notices 
                (id, row_num, type, category, company, notice_at, noticed_by, notice_text) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            );

            const batch = c.env.DB.batch(
                notices.map((notice: Notice) =>
                    stmt.bind(
                        notice.id,
                        notice.rowNum,
                        notice.type,
                        notice.category,
                        notice.company,
                        notice.noticeAt,
                        notice.noticedBy,
                        notice.noticeText
                    )
                )
            );

            await batch;

            return c.json({ message: `${notices.length} notices processed` });
        } catch (error) {
            console.error("Error processing notices webhook:", error);
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

        // Validate date format
        if (isNaN(Date.parse(requestedAt))) {
            return c.json({ message: "Invalid requestedAt date format" }, 400);
        }

        console.log("Requested OTP for rollNo:", rollNo, "at", requestedAt);

        const row = await c.env.DB.prepare(
            `SELECT otp, created_at FROM otps
            WHERE roll_no = ? AND created_at > ?
            ORDER BY created_at ASC
            LIMIT 1`
        )
            .bind(rollNo, requestedAt)
            .first();

        console.log("OTP row found:", !!row);

        if (!row) {
            console.log("No OTP found for rollNo:", rollNo);
            return c.json({ message: "No OTP found yet" }, 404);
        }

        return c.json({ otp: row.otp, createdAt: row.created_at });
    } catch (error) {
        console.error("Error fetching OTP:", error);
        return c.json({ message: "Internal server error" }, 500);
    }
});

export default app;
