export interface Env {
    NOTICES_URL: string;

    // Main User Facing API
    NOTICE_WEBHOOK_URL: string;
    OTP_API_URL: string;

    // Cloudflare
    CLOUDFLARE_ACCOUND_ID: string;
    CLOUDFLARE_DATABASE_ID: string;
    CLOUDFLARE_D1_TOKEN: string;
}
