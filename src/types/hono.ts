export interface Env {
    NOTICES_URL: string;

    // Main User Facing API
    NOTICE_WEBHOOK_URL: string;

    // Cloudflare
    CLOUDFLARE_KV_URL: string;
    CLOUDFLARE_AUTH_EMAIL: string;
    CLOUDFLARE_AUTH_KEY: string;
}
