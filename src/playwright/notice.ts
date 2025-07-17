import { type Page } from "playwright";
import type { Env } from "../types/hono.js";
import type { Notice } from "../types/notice.js";

export class NoticeScraper {
    private NOTICES_URL: string;
    private LAST_NOTICE_AT: string;

    constructor(private page: Page, ENV: Env, lastKnownNoticeAt: string) {
        this.NOTICES_URL = ENV.NOTICES_URL;
        this.LAST_NOTICE_AT = lastKnownNoticeAt;
    }

    public async scrape() {
        if (!this.page) {
            throw new Error("Page not available for scraping");
        }

        if (!this.NOTICES_URL) {
            throw new Error("NOTICES_URL not configured");
        }

        const page = this.page;
        const notices: Notice[] = [];

        try {
            console.log(`Navigating to notices page: ${this.NOTICES_URL}`);
            await page.goto(this.NOTICES_URL, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });

            console.log("Waiting for notices grid...");
            await page.waitForSelector("#grid54", {
                state: "visible",
                timeout: 15000,
            });

            // Check if grid has data
            const gridExists = await page.locator("#grid54").count();
            if (gridExists === 0) {
                throw new Error("Notices grid not found on page");
            }

            const rows = await page.locator("#grid54 tr.jqgrow").all();
            console.log(`Found ${rows.length} notice rows`);

            if (rows.length === 0) {
                console.log("No notices found in grid");
                return notices;
            }

            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = page.locator("#grid54 tr.jqgrow").nth(i);

                    const noticeAt =
                        (
                            await row
                                .locator('[aria-describedby="grid54_noticeat"]')
                                .textContent()
                        )?.trim() || "";

                    if (!noticeAt) {
                        console.warn(`Row ${i}: Missing notice date, skipping`);
                        continue;
                    }

                    // Parse dates using helper
                    const noticeDate = new Date(noticeAt);
                    const lastKnownDate = new Date(this.LAST_NOTICE_AT);

                    console.log(
                        "Notice date:",
                        noticeDate,
                        "Last known date:",
                        lastKnownDate
                    );

                    if (!noticeDate || !lastKnownDate) {
                        console.warn(
                            `Row ${i}: Invalid notice date format: ${noticeAt}`
                        );
                        continue;
                    }

                    // Only scrape notices newer than LAST_NOTICE_AT
                    if (noticeDate <= lastKnownDate) {
                        console.log(
                            `Reached notices older than ${this.LAST_NOTICE_AT}, stopping`
                        );
                        break;
                    }

                    const rawRowNum = await row
                        .locator('[aria-describedby="grid54_rn"]')
                        .textContent();
                    const rawId = await row
                        .locator('[aria-describedby="grid54_id"]')
                        .textContent();
                    const rawNoticedBy = await row
                        .locator('[aria-describedby="grid54_noticeby"]')
                        .textContent();

                    const rowNum = parseInt(rawRowNum || "0", 10);
                    const id = parseInt(rawId || "0", 10);
                    const noticedBy = parseInt(rawNoticedBy || "0", 10);

                    if (rowNum === 0 || id === 0) {
                        console.warn(
                            `Row ${i}: Invalid row number or ID, skipping`
                        );
                        continue;
                    }

                    // Get basic notice data first
                    const type =
                        (
                            await row
                                .locator('[aria-describedby="grid54_type"]')
                                .textContent()
                        )?.trim() || "";

                    const category =
                        (
                            await row
                                .locator('[aria-describedby="grid54_category"]')
                                .textContent()
                        )?.trim() || "";

                    const company =
                        (
                            await row
                                .locator('[aria-describedby="grid54_company"]')
                                .textContent()
                        )?.trim() || "";

                    // Click notice link to open dialog and get full text
                    let fullNoticeText = "";
                    try {
                        const noticeLink = row.locator(
                            '[aria-describedby="grid54_notice"] a'
                        );
                        await noticeLink.click();

                        // Wait for dialog to appear
                        await page.waitForSelector(".ui-dialog", {
                            state: "visible",
                            timeout: 10000,
                        });

                        // Wait for iframe to load
                        const iframe = page.frameLocator(
                            ".ui-dialog-content iframe"
                        );
                        await iframe
                            .locator("#printableArea")
                            .waitFor({ timeout: 10000 });

                        // Extract full notice text from iframe
                        fullNoticeText =
                            (await iframe
                                .locator("#printableArea")
                                .textContent()) || "";
                        fullNoticeText = fullNoticeText.trim();

                        // Close dialog
                        await page.locator(".ui-dialog-titlebar-close").click();
                        await page.waitForSelector(".ui-dialog", {
                            state: "hidden",
                            timeout: 5000,
                        });
                    } catch (dialogError) {
                        console.warn(
                            `Row ${i}: Failed to extract full notice text:`,
                            dialogError
                        );
                        // Fallback to title attribute if dialog fails
                        fullNoticeText =
                            (
                                await row
                                    .locator(
                                        '[aria-describedby="grid54_notice"] a'
                                    )
                                    .getAttribute("title")
                            )?.trim() || "";
                    }

                    const notice = {
                        rowNum,
                        id,
                        type,
                        category,
                        company,
                        noticeAt,
                        noticedBy,
                        noticeText: fullNoticeText,
                    };

                    notices.push(notice);
                    console.log(
                        `[${i + 1}/${rows.length}] Scraped notice ${
                            notice.rowNum
                        }: ${notice.type}`
                    );
                } catch (rowError) {
                    console.error(`Error processing row ${i}:`, rowError);
                    // Continue with next row instead of failing completely
                    continue;
                }
            }

            console.log(`Successfully scraped ${notices.length} new notices`);
            return notices;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error("Notice scraping failed:", errorMessage);
            throw new Error(`Failed to scrape notices: ${errorMessage}`);
        }
    }
}
