import {
    chromium,
    type Browser,
    type BrowserContext,
    type Page,
} from "playwright";
import type { Env } from "../types/hono.js";
import { getOTPWithBackoff } from "../utils/getOTP.js";

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
        try {
            this.browser = await chromium.launch({
                headless: true,
                timeout: 30000
            });
            this.context = await this.browser.newContext({
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
            this.page = await this.context.newPage();
            console.log("Browser initialized successfully");
        } catch (error) {
            throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async login() {
        if (!this.page) {
            throw new Error("Browser not initialized. Call init() first.");
        }

        const page = this.page;

        try {
            console.log("Navigating to ERP login page...");
            await page.goto(ERP_URL, {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });

            await page.waitForURL(/SSOAdministration\/login\.htm/, {
                timeout: 15000,
            });

            console.log("Waiting for login form...");
            await page.waitForSelector('input[name="user_id"]', {
                state: "visible",
                timeout: 10000,
            });

            console.log("Filling login credentials...");
            await page.fill('input[name="user_id"]', this.rollNo);
            await page.fill('input[name="password"]', this.password);

            console.log("Waiting for security question...");
            await page.waitForSelector("#answer_div:not(.hidden)", {
                state: "visible",
                timeout: 10000,
            });

            const questionElement = await page.locator("#question").first();
            const question = (await questionElement.textContent())?.trim();

            if (!question) {
                throw new Error("Security question not found or empty");
            }

            console.log(`Security question: ${question}`);
            const answer = this.securityAnswers[question];

            if (!answer) {
                throw new Error(
                    `No answer provided for security question: "${question}". Available questions: ${Object.keys(this.securityAnswers).join(", ")}`
                );
            }

            await page.fill("#answer", answer);

            console.log("Requesting OTP...");
            await page.click("#getotp");

            // Wait a moment for the OTP request to be processed
            await page.waitForTimeout(1000);

            console.log("Fetching OTP...");
            const otp = await getOTPWithBackoff(
                this.ENV.OTP_API_URL,
                this.rollNo,
                5,
                2000
            );

            console.log("Entering OTP...");
            await page.fill("#email_otp1", otp);
            await page.click("#loginFormSubmitButton");

            // Wait for navigation or error message
            await page.waitForTimeout(3000);

            // Check if login was successful by looking for error messages
            const errorElements = await page.locator('.error, .alert-danger, [class*="error"]').all();
            for (const errorElement of errorElements) {
                const errorText = await errorElement.textContent();
                if (errorText && errorText.trim()) {
                    throw new Error(`Login failed: ${errorText.trim()}`);
                }
            }

            console.log("Login successful.");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Login failed:", errorMessage);
            throw new Error(`Login failed: ${errorMessage}`);
        }
    }

    public getPage(): Page {
        if (!this.page) {
            throw new Error("Page not available. Ensure session is initialized and logged in.");
        }
        return this.page;
    }

    public async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log("Browser closed successfully");
            }
        } catch (error) {
            console.error("Error closing browser:", error);
            throw new Error(`Failed to close browser: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
