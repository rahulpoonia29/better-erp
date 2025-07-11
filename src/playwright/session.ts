import {
    chromium,
    type Browser,
    type BrowserContext,
    type Page,
} from "playwright";
import { getOTPWithBackoff } from "../utils/getOTP.js";
import type { Env } from "../types/hono.js";

const ERP_URL = process.env.ERP_URL || "https://erp.iitkgp.ac.in";

export class ErpSession {
    private browser!: Browser;
    private context!: BrowserContext;
    private page!: Page;

    // Cloudflare KV access
    private ENV: Env;

    constructor(
        private rollNo: string,
        private password: string,
        private securityAnswers: Record<string, string>,
        ENV: Env
    ) {
        this.ENV = ENV;
    }

    public async init() {
        this.browser = await chromium.launch({ headless: true });
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();
    }

    public async login() {
        const page = this.page;

        await page.goto(ERP_URL, { waitUntil: "domcontentloaded" });
        await page.waitForURL(/SSOAdministration\/login\.htm/, {
            timeout: 10000,
        });
        await page.waitForSelector('input[name="user_id"]', {
            state: "visible",
            timeout: 5000,
        });

        await page.fill('input[name="user_id"]', this.rollNo);
        await page.fill('input[name="password"]', this.password);

        await page.waitForSelector("#answer_div:not(.hidden)", {
            state: "visible",
        });
        const question = (await page.textContent("#question"))?.trim();
        if (!question) throw new Error("Security question not found");

        const answer = this.securityAnswers[question];
        if (!answer) throw new Error(`No answer for question: "${question}"`);

        await page.fill("#answer", answer);
        await page.click("#getotp");

        // ! Fix it with OTP fetching

        const otp = await getOTPWithBackoff(this.ENV.CLOUDFLARE_KV_URL, {
            "X-Auth-Email": this.ENV.CLOUDFLARE_AUTH_EMAIL,
            "X-Auth-Key": this.ENV.CLOUDFLARE_AUTH_KEY,
        });

        await page.fill("#email_otp1", otp);
        await page.click("#loginFormSubmitButton");

        await page.waitForTimeout(2000);
        console.log("Login successful.");
    }

    public getPage(): Page {
        return this.page;
    }

    public async close() {
        await this.browser.close();
    }
}
