export async function getOTPWithBackoff(
    OTP_API_URL: string,
    rollNo: string,
    maxAttempts: number = 6,
    initialDelay: number = 2000,
    backoffDelay: number = 2000
): Promise<string> {
    if (!OTP_API_URL || !rollNo) {
        throw new Error("OTP_API_URL and rollNo are required");
    }

    const requestedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    await new Promise((r) => setTimeout(r, initialDelay));

    let attempt = 0;
    let delay = backoffDelay;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
        try {
            const url = `${OTP_API_URL}/${rollNo}?requestedAt=${encodeURIComponent(
                requestedAt
            )}`;
            console.log(
                `Attempt ${attempt + 1}/${maxAttempts}: Requesting OTP from ${url}`
            );

            const res = await fetch(url);

            console.log(
                `Response: ${res.status} ${res.statusText} after ${delay}ms delay`
            );

            if (res.ok) {
                const responseText = await res.text();
                let responseData;

                try {
                    responseData = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error(`Invalid JSON response: ${responseText}`);
                }

                const { otp } = responseData as { otp?: string; createdAt?: string };

                if (otp && typeof otp === "string" && otp.trim()) {
                    console.log("OTP fetched successfully");
                    return otp.trim();
                } else {
                    throw new Error("Invalid OTP format or empty OTP received");
                }
            } else if (res.status === 404) {
                // OTP not ready yet, continue retrying
                console.log("OTP not ready yet, retrying...");
            } else {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.log(`Attempt ${attempt + 1} failed:`, lastError.message);
        }

        if (attempt < maxAttempts - 1) {
            console.log(`Waiting ${delay}ms before next attempt...`);
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * 2, 30000);
        }
        attempt++;
    }

    throw new Error(
        `Failed to get OTP after ${maxAttempts} attempts. Last error: ${lastError?.message || "Unknown error"
        }`
    );
}
