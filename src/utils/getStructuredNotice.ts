import { GoogleGenAI, Type } from "@google/genai";
import { structuredNoticeSystemPrompt } from "../prompts/structuredNotice.js";

export async function generateStructuredNotice(
    apiKey: string,
    rawNotice: Record<string, any>
) {
    const ai = new GoogleGenAI({
        apiKey: apiKey,
    });

    // put the rawNotice at the end of the prompt
    const fullInput = `Process the following input and return the structured JSON output:\n${JSON.stringify(
        rawNotice,
        null,
        2
    )}`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction: structuredNoticeSystemPrompt,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    companyName: { type: Type.STRING },
                    noticeTimestamp: { type: [Type.STRING, Type.NULL] },
                    summary: { type: [Type.STRING, Type.NULL] },
                    primaryDeadline: { type: [Type.STRING, Type.NULL] },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                    contextPoints: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                    notes: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                    actions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: {
                                    type: Type.STRING,
                                    enum: [
                                        "APPLY",
                                        "FILL_FORM",
                                        "ATTEND_EVENT",
                                        "SUBMIT_INTERNAL",
                                        "CV Submission",
                                    ],
                                },
                                title: { type: [Type.STRING, Type.NULL] },
                                details: { type: [Type.STRING, Type.NULL] },
                                isMandatory: { type: Type.BOOLEAN },
                                eventDetails: {
                                    type: Type.OBJECT,
                                    properties: {
                                        startTime: {
                                            type: [Type.STRING, Type.NULL],
                                        },
                                        endTime: {
                                            type: [Type.STRING, Type.NULL],
                                        },
                                        mode: {
                                            type: [Type.STRING],
                                            enum: [
                                                "Online",
                                                "Offline",
                                                "Hybrid",
                                                "null",
                                            ],
                                        },
                                        location: {
                                            type: [Type.STRING, Type.NULL],
                                        },
                                        link: {
                                            type: [Type.STRING, Type.NULL],
                                        },
                                    },
                                },
                            },
                        },
                    },
                    originalNotice: { type: Type.STRING },
                },
            },
        },
        contents: fullInput,
    });

    // for await (const chunk of response) {
    //     console.log(chunk.text);
    // }

    // return response;

    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return JSON.parse(response.candidates[0].content.parts[0].text);
    }

    throw new Error("Failed to get structured notice from Gemini.");
}
