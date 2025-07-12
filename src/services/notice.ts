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
    const { rollNo, password, securityAnswers, ENV, lastKnownNoticeAt } = params;

    // Validate required parameters
    if (!rollNo || !password || !securityAnswers || !ENV) {
        throw new Error("Missing required parameters for notice scraping");
    }

    if (!ENV.NOTICES_URL || !ENV.NOTICE_WEBHOOK_URL || !ENV.OTP_API_URL) {
        throw new Error("Missing required environment variables");
    }

    let session: ErpSession | null = null;

    try {
        session = new ErpSession(rollNo, password, securityAnswers, ENV);

        console.log("Initializing session...");
        await session.init();

        console.log("Logging in...");
        await session.login();

        console.log("Starting notice scraping...");
        const scraper = new NoticeScraper(
            session.getPage(),
            ENV,
            lastKnownNoticeAt
        );
        const notices = await scraper.scrape();

        if (!notices || notices.length === 0) {
            console.log("No new notices found");
            return;
        }

        console.log(`Found ${notices.length} new notices, posting to webhook...`);

        // Post the notices to the webhook with retry logic
        const webhookResponse = await fetch(ENV.NOTICE_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(notices),
        });

        if (!webhookResponse.ok) {
            throw new Error(
                `Webhook failed: ${webhookResponse.status} ${webhookResponse.statusText}`
            );
        }

        console.log("Successfully posted notices to webhook");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Notice scraping failed:", errorMessage);
        throw new Error(`Notice scraping failed: ${errorMessage}`);
    } finally {
        if (session) {
            try {
                await session.close();
                console.log("Session closed successfully");
            } catch (closeError) {
                console.error("Error closing session:", closeError);
            }
        }
    }
}
