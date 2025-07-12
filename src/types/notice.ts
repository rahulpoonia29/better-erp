import z from "zod";

export const NoticeSchema = z.object({
    rowNum: z.number(),
    id: z.number(),
    type: z.string(),
    category: z.string(),
    company: z.string(),
    noticeAt: z.string(),
    noticedBy: z.number(),
    noticeText: z.string(),
});

export type Notice = z.infer<typeof NoticeSchema>;
