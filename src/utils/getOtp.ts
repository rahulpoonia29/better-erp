export async function getOTPWithBackoff(
    OTP_API_URL: string,
    rollNo: string,
    maxAttempts = 6,
    initialDelay = 2000,
    backoffDelay = 2000
): Promise<string> {
    if (!OTP_API_URL || !rollNo) {
        throw new Error("OTP_API_URL and rollNo are required");
    }

    const requestedAt = new Date().toISOString();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    await sleep(initialDelay);

    let attempt = 0;
    let delay = backoffDelay;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
        const url = `${OTP_API_URL}/${encodeURIComponent(rollNo)}?requestedAt=${encodeURIComponent(requestedAt)}`;
        console.log(`Attempt ${attempt + 1}/${maxAttempts}: Requesting OTP from ${url}`);

        try {
            const res = await fetch(url);

            if (res.ok) {
                const { otp, createdAt } = await res.json<{
                    otp: string;
                    createdAt: string;
                }>();

                console.log(`✅ Response: otp=${otp}, createdAt=${createdAt}`);

                if (otp != null) {
                    return String(otp).trim();
                }

                throw new Error("Invalid or empty OTP received");
            }

            if (res.status === 404) {
                console.log("⚠️ OTP not ready yet (404), retrying...");
            } else {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.log(`❌ Attempt ${attempt + 1} failed: ${lastError.message}`);
        }

        attempt++;

        if (attempt < maxAttempts) {
            console.log(`⏳ Waiting ${delay}ms before next attempt...`);
            await sleep(delay);
            delay = Math.min(delay * 2, 30000);
        }
    }

    throw new Error(
        `Failed to get OTP after ${maxAttempts} attempts. Last error: ${lastError?.message || "Unknown"}`
    );
}
