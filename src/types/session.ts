import z from "zod";

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
