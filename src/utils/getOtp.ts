export async function getOTPWithBackoff(
    OTP_API_URL: string,
    rollNo: string,
    maxAttempts: number = 6,
    initialDelay: number = 2000
): Promise<string> {
    const requestedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxAttempts) {
        try {
            const url = `${OTP_API_URL}/${rollNo}?requestedAt=${requestedAt}`;
            const res = await fetch(url);

            console.log(
                "The response from server ",
                res.status,
                res.statusText,
                " after a delay of ",
                delay
            );

            if (res.ok) {
                const { otp } = (await res.json()) as {
                    otp: string;
                    createdAt: string;
                };

                if (otp && typeof otp === "string" && otp.trim()) {
                    console.log("OTP fetched successfully:", otp);
                    return otp.trim();
                }
            }
        } catch {
            // Ignore error and continue retrying
        }
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2; // Exponential backoff
        attempt++;
    }
    throw new Error("Failed to get OTP after multiple attempts.");
}
