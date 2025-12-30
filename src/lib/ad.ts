import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type AdOut = {
  headline: string;
  short: string;
  body: string;
  bulletPoints: string[];
};

export function buildAdPrompt(car: any) {
  return `
Write a used-car marketplace ad in ENGLISH.
Be clear and honest. Do not invent missing facts.
Avoid hype like "best", "perfect", "must-see".
Return VALID JSON with keys:
headline (<= 70 chars), short (<= 240 chars), body (2 short paragraphs), bulletPoints (4-6 items).

Car details:
${JSON.stringify(car, null, 2)}
`.trim();
}

