import { Hono } from "hono";
import { NoticeSchema, type Notice } from "../types/notice.js";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { AuthCredantialsSchema } from "../types/session.js";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/notices", async (c) => {
    const since = c.req.query("since") || "1970-01-01T00:00:00Z";
    const limit = parseInt(c.req.query("limit") || "50", 10);

    const { results } = await c.env.DB.prepare(
        `SELECT * FROM notices WHERE notice_at > ? ORDER BY notice_at DESC LIMIT ?`
    )
        .bind(since, limit)
        .all();

    return c.json(results);
});

app.post(
    "/scrape-notices",
    zValidator("json", AuthCredantialsSchema),
    async (c) => {
        const data = c.req.valid("json");

        const res = await c.env.DB.prepare(
            `SELECT MAX(notice_at) as lastNoticeAt FROM notices`
        ).first<{ lastNoticeAt: string | null }>();

        const lastNoticeAt = res?.lastNoticeAt || "1970-01-01T00:00:00Z";

        // Trigger the scraper (BPS) by calling its API
        const scraperRes = await fetch(
            `${c.env.SCRAPER_API_URL}/scrape-notices`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    lastNoticeAt,
                }),
            }
        );

        if (!scraperRes.ok) {
            return c.json(
                {
                    message: "Failed to trigger scraper",
                    error: await scraperRes.text(),
                },
                500
            );
        }

        return c.json({
            message: "Scraper triggered successfully",
            lastNoticeAt,
        });
    }
);

app.post(
    "/notices/webhook",
    zValidator("json", z.array(NoticeSchema)),
    async (c) => {
        const notices = c.req.valid("json");

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
    }
);

app.get("/otp/:rollNo", async (c) => {
    const rollNo = c.req.param("rollNo");
    const requestedAt = c.req.query("requestedAt");

    console.log("Requested OTP for rollNo:", rollNo, "at", requestedAt);

    if (!requestedAt) {
        return c.json({ message: "requestedAt query param required" }, 400);
    }

    const row = await c.env.DB.prepare(
        `
    SELECT otp, created_at FROM otps
    WHERE roll_no = ? AND created_at > ?
    ORDER BY created_at ASC
    LIMIT 1
  `
    )
        .bind(rollNo, requestedAt)
        .first();

    console.log("OTP row found:", row);

    if (!row) {
        console.log("No OTP found for rollNo:", rollNo);
        return c.json({ message: "No OTP found yet" }, 404);
    }

    return c.json({ otp: row.otp, createdAt: row.created_at });
});

export default app;
