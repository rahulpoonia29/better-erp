// import readline from "readline";

// export function getOTP(query: string): Promise<string> {
//     return new Promise((resolve) => {
//         const rl = readline.createInterface({
//             input: process.stdin,
//             output: process.stdout,
//         });
//         rl.question(query, (input) => {
//             rl.close();
//             resolve(input.trim());
//         });
//     });
// }

export async function getOTPWithBackoff(
    url: string,
    headers: Record<string, string>,
    maxAttempts: number = 6,
    initialDelay: number = 1000
): Promise<string> {
    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxAttempts) {
        try {
            const response = await fetch(url, { headers });
            const data = await response.text();
            if (data && typeof data === "string" && data.trim()) {
                return data.trim();
            }
        } catch (error) {
            // Ignore error and continue retrying
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        attempt++;
    }
    throw new Error("Failed to get OTP after multiple attempts.");
}
