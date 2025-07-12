import z from "zod";
import { NoticeScraper } from "../playwright/notice.js";
import { ErpSession } from "../playwright/session.js";
import type { Env } from "../types/hono.js";
import { AuthCredantialsSchema } from "../types/session.js";

export const NoticeScrapeParamsSchema = AuthCredantialsSchema.extend({
    lastKnownNoticeAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "lastKnownNoticeAt must be a valid ISO date string",
    }),
});

type NoticeScrapeParams = z.infer<typeof AuthCredantialsSchema> & {
    ENV: Env;
    lastKnownNoticeAt: string;
};

export async function scrapeNotices(params: NoticeScrapeParams) {
    const { rollNo, password, securityAnswers } = params;
    const session = new ErpSession(
        rollNo,
        password,
        securityAnswers,
        params.ENV
    );
    await session.init();
    await session.login();

    const scraper = new NoticeScraper(
        session.getPage(),
        params.ENV,
        params.lastKnownNoticeAt
    );
    const notices = await scraper.scrape();

    // Post the notices to the webhook using fetch
    await fetch(params.ENV.NOTICE_WEBHOOK_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(notices),
    });

    // console.log("Scraped notices:", notices);

    await session.close();
}
