import { z } from "zod";

export type StructuredNotice = {
    // id: string;
    company: string;
    category:
        | "CV_SUBMISSION"
        | "DATE_EXTENSION"
        | "PPT/WORKSHOP"
        | "SHORTLIST"
        | "GENERAL";
    // postedAt?: string;
    deadline: string; // ISO date-time
    summary: string;
    // tags?: string[];
    context: string[];
    actions: Action[];
    pocs: PointOfContact[];
    originalNotice: string;
};

export type Action = {
    type: "CV_SUBMISSION" | "ATTEND_EVENT" | "FILL_FORM" | "OTHER";
    title: string;
    details: string;
    mandatory: boolean;
    event: EventDetails;
};

export type EventDetails = {
    at: string; // ISO date-time
    location: string;
    link: string;
    mode: "Online" | "Offline" | "Hybrid";
};

export type PointOfContact = {
    name: string;
    contact: string;
};

export const PointOfContactSchema = z.object({
    name: z.string(),
    contact: z.string(),
});

export const EventDetailsSchema = z.object({
    at: z.string().datetime(),
    location: z.string(),
    link: z.string(),
    mode: z.enum(["Online", "Offline", "Hybrid"]),
});

export const ActionSchema = z.object({
    type: z.enum(["CV_SUBMISSION", "ATTEND_EVENT", "FILL_FORM", "OTHER"]),
    title: z.string(),
    details: z.string(),
    mandatory: z.boolean(),
    event: EventDetailsSchema,
});

export const StructuredNoticeSchema = z.object({
    company: z.string(),
    category: z.enum([
        "CV_SUBMISSION",
        "DATE_EXTENSION",
        "PPT/WORKSHOP",
        "SHORTLIST",
        "GENERAL",
    ]),
    postedAt: z.iso.datetime(),
    deadline: z.iso.datetime(),
    summary: z.string(),
    context: z.array(z.string()),
    actions: z.array(ActionSchema),
    pocs: z.array(PointOfContactSchema),
    originalNotice: z.string(),
});
