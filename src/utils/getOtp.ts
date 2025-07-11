import readline from "readline";

export function promptInput(query: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(query, (input) => {
            rl.close();
            resolve(input.trim());
        });
    });
}
