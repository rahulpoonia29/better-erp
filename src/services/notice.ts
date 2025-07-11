import { NoticeScraper } from "../playwright/notice.js";
import { ErpSession } from "../playwright/session.js";
import type { Env } from "../types/hono.js";
import type { AuthCredantials } from "../types/session.js";

type ScrapeParams = AuthCredantials & {
    ENV: Env;
};

export async function scrapeNotices(params: ScrapeParams) {
    const { rollNo, password, securityAnswers } = params;
    const session = new ErpSession(rollNo, password, securityAnswers);
    await session.init();
    await session.login();

    const scraper = new NoticeScraper(session.getPage(), params.ENV);
    const notices = await scraper.scrape();

    console.log("Scraped notices:", notices);

    await session.close();
}
