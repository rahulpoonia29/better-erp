import z from "zod";

const eventDetailsSchema = z.object({
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    mode: z.enum(["Online", "Offline", "Hybrid"]).nullable(),
    location: z.string().nullable(),
    link: z.string().nullable(),
});

const actionSchema = z.object({
    type: z.string(), // or if you have a fixed set of values, change to z.enum([...])
    title: z.string(),
    details: z.string(),
    isMandatory: z.boolean(),
    eventDetails: eventDetailsSchema.nullable(),
});

export const structuredNoticeSchema = z.object({
    companyName: z.string(),
    noticeTimestamp: z.string(),
    summary: z.string(),
    primaryDeadline: z.string().nullable(),
    tags: z.array(z.string()),
    contextPoints: z.array(z.string()),
    actions: z.array(actionSchema),
    originalNotice: z.string(),
});
