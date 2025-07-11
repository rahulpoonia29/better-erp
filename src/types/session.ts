import z from "zod";

// export const defaultAuthCredentials: AuthCredantials = {
//     rollNo: process.env.ERP_USER || "23BT10029",
//     password: process.env.ERP_PASS || "rahulerp",
//     securityAnswers: {
//         "1": "a",
//         "2": "b",
//         "3": "c",
//     },
// };

export const AuthCredantialsSchema = z.object({
    rollNo: z.string().regex(/^\d{2}[A-Za-z]{2}\d{5}$/, {
        message: "rollNo must be in format DDYYDDDDD (e.g., 23XX10012)",
    }),
    password: z.string(),
    securityAnswers: z
        .record(z.string(), z.string())
        .refine((obj) => Object.keys(obj).length === 3, {
            message: "securityAnswers must have exactly 3 entries",
        }),
});

export type AuthCredantials = z.infer<typeof AuthCredantialsSchema>;
