import { GoogleGenAI, Type } from "@google/genai";
import { structuredNoticeSystemPrompt } from "../prompts/structuredNotice.js";
import type { StructuredNotice } from "../types/structuredNotice.js";

export async function generateStructuredNotice(
    apiKey: string,
    rawNotice: Record<string, any>
): Promise<StructuredNotice> {
    const ai = new GoogleGenAI({
        apiKey: apiKey,
    });

    const config = {
        thinkingConfig: {
            thinkingBudget: 0,
        },
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            required: [
                "company",
                "category",
                "deadline",
                "summary",
                "context",
                "actions",
                "pocs",
                "originalNotice",
            ],
            properties: {
                company: {
                    type: Type.STRING,
                },
                category: {
                    type: Type.STRING,
                    enum: [
                        "CV_SUBMISSION",
                        "DATE_EXTENSION",
                        "PPT/WORKSHOP",
                        "SHORTLIST",
                        "GENERAL",
                    ],
                },
                // postedAt: {
                //     type: Type.STRING,
                //     format: "date-time",
                // },
                deadline: {
                    type: Type.STRING,
                    format: "date-time",
                },
                summary: {
                    type: Type.STRING,
                },
                // tags: {
                //     type: Type.ARRAY,
                //     items: {
                //         type: Type.STRING,
                //     },
                // },
                context: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                    },
                },
                actions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        required: [
                            "type",
                            "title",
                            "details",
                            "mandatory",
                            "event",
                        ],
                        properties: {
                            type: {
                                type: Type.STRING,
                                enum: [
                                    "CV_SUBMISSION",
                                    "ATTEND_EVENT",
                                    "FILL_FORM",
                                    "OTHER",
                                ],
                            },
                            title: {
                                type: Type.STRING,
                            },
                            details: {
                                type: Type.STRING,
                            },
                            mandatory: {
                                type: Type.BOOLEAN,
                            },
                            event: {
                                type: Type.OBJECT,
                                required: ["at", "location", "link", "mode"],
                                properties: {
                                    at: {
                                        type: Type.STRING,
                                        format: "date-time",
                                    },
                                    location: {
                                        type: Type.STRING,
                                    },
                                    link: {
                                        type: Type.STRING,
                                    },
                                    mode: {
                                        type: Type.STRING,
                                        enum: ["Online", "Offline", "Hybrid"],
                                    },
                                },
                            },
                        },
                    },
                },
                pocs: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        required: ["name", "contact"],
                        properties: {
                            name: {
                                type: Type.STRING,
                            },
                            contact: {
                                type: Type.STRING,
                            },
                        },
                    },
                },
                originalNotice: {
                    type: Type.STRING,
                },
            },
        },
        systemInstruction: [
            {
                text: structuredNoticeSystemPrompt,
            },
        ],
    };
    const model = "gemini-2.5-flash";
    const contents = [
        {
            role: "user",
            parts: [
                {
                    text: JSON.stringify(rawNotice, null, 2),
                },
            ],
        },
    ];

    const response = await ai.models.generateContent({
        model,
        config,
        contents,
    });

    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return JSON.parse(response.candidates[0].content.parts[0].text);
    }

    throw new Error("Failed to get structured notice from Gemini.");
}
