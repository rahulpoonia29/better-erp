import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { NoticeScrapeParamsSchema, scrapeNotices } from "./services/notice.js";
import type { Env } from "./types/hono.js";
import { env } from "hono/adapter";

interface HonoType {
    Bindings: Env;
}

const app = new Hono<HonoType>();

app.get("/", (c) => {
    return c.text("Hello Hono!");
});

app.post(
    "/scrape-notices",
    zValidator("json", NoticeScrapeParamsSchema),
    async (c) => {
        try {
            const data = c.req.valid("json");
            const { NOTICES_URL, NOTICE_WEBHOOK_URL, OTP_API_URL } = env(c);

            if (!NOTICES_URL || !NOTICE_WEBHOOK_URL || !OTP_API_URL) {
                return c.json(
                    {
                        message: "Missing required environment variables",
                        missing: {
                            NOTICES_URL: !NOTICES_URL,
                            NOTICE_WEBHOOK_URL: !NOTICE_WEBHOOK_URL,
                            OTP_API_URL: !OTP_API_URL,
                        },
                    },
                    500
                );
            }

            // Start scraping asynchronously but don't await it
            scrapeNotices({
                ...data,
                ENV: {
                    NOTICES_URL,
                    NOTICE_WEBHOOK_URL,
                    OTP_API_URL,
                },
            }).catch((error) => {
                console.error("Scraping process failed:", error);
            });

            return c.json({ message: "Scraping started" });
        } catch (error) {
            console.error("Error starting scrape process:", error);
            return c.json(
                {
                    message: "Failed to start scraping",
                    error: error instanceof Error ? error.message : String(error),
                },
                500
            );
        }
    }
);

serve(
    {
        fetch: app.fetch,
        port: 9000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
