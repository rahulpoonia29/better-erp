import { type Page } from "playwright";
import type { Env } from "../types/hono.js";

export class NoticeScraper {
    private NOTICES_URL: string;

    constructor(private page: Page, ENV: Env) {
        this.NOTICES_URL = ENV.NOTICES_URL;
    }

    public async scrape() {
        const page = this.page;
        const notices = [];

        await page.goto(this.NOTICES_URL, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#grid54", {
            state: "visible",
            timeout: 10000,
        });

        const rows = await page.locator("#grid54 tr.jqgrow").all();

        for (let i = 0; i < rows.length; i++) {
            const row = page.locator("#grid54 tr.jqgrow").nth(i);

            const notice = {
                rowNum: parseInt(
                    (await row
                        .locator('[aria-describedby="grid54_rn"]')
                        .textContent()) || "0",
                    10
                ),
                id: parseInt(
                    (await row
                        .locator('[aria-describedby="grid54_id"]')
                        .textContent()) || "0",
                    10
                ),
                type:
                    (
                        await row
                            .locator('[aria-describedby="grid54_type"]')
                            .textContent()
                    )?.trim() || "",
                category:
                    (
                        await row
                            .locator('[aria-describedby="grid54_category"]')
                            .textContent()
                    )?.trim() || "",
                company:
                    (
                        await row
                            .locator('[aria-describedby="grid54_company"]')
                            .textContent()
                    )?.trim() || "",
                noticeAt:
                    (
                        await row
                            .locator('[aria-describedby="grid54_noticeat"]')
                            .textContent()
                    )?.trim() || "",
                noticedBy: parseInt(
                    (await row
                        .locator('[aria-describedby="grid54_noticeby"]')
                        .textContent()) || "0",
                    10
                ),
                noticeText:
                    (
                        await row
                            .locator('[aria-describedby="grid54_notice"] a')
                            .getAttribute("title")
                    )?.trim() || "",
            };

            notices.push(notice);
            console.log(
                `[${i + 1}/${rows.length}] Scraped notice ${notice.rowNum}`
            );
        }

        return notices;
    }
}
