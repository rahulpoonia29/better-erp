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
        const data = c.req.valid("json");
        const { NOTICES_URL, NOTICE_WEBHOOK_URL, OTP_API_URL } = env(c);

        scrapeNotices({
            ...data,
            ENV: {
                NOTICES_URL,
                NOTICE_WEBHOOK_URL,
                OTP_API_URL,
            },
        });

        return c.json({ message: "Scraping started" });
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
