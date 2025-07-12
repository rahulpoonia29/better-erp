import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { NoticeScrapeParamsSchema, scrapeNotices } from "./services/notice.js";
import type { Env } from "./types/hono.js";

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

        scrapeNotices({
            ...data,
            ENV: c.env,
        });

        return c.json({ message: "Scraping started" });
    }
);

serve(
    {
        fetch: app.fetch,
        port: 2900,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
