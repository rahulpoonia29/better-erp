import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Env } from "./types/hono.js";
import { zValidator } from "@hono/zod-validator";
import { AuthCredantialsSchema } from "./types/session.js";
import { scrapeNotices } from "./services/notice.js";

interface HonoType {
    Bindings: Env;
}

const app = new Hono<HonoType>();

app.get("/", (c) => {
    return c.text("Hello Hono!");
});

app.post(
    "/scrape-notices",
    zValidator("json", AuthCredantialsSchema),
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
        port: 3000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
