import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type AdOut = {
  headline: string;
  short: string;
  body: string;
  bulletPoints: string[];
};

export function buildAdPrompt(car: any, language: "en" | "sv" = "en") {
  const languageName = language === "sv" ? "SWEDISH" : "ENGLISH";
  const languageInstructions = language === "sv" 
    ? "Skriv en begagnad bilannons på SVENSKA. Var tydlig och ärlig. Hitta inte på saknade fakta. Undvik överdrifter som 'bäst', 'perfekt', 'måste se'."
    : "Write a used-car marketplace ad in ENGLISH. Be clear and honest. Do not invent missing facts. Avoid hype like 'best', 'perfect', 'must-see'.";
  
  return `
${languageInstructions}
Return VALID JSON with keys:
headline (<= 70 chars), short (<= 240 chars), body (2 short paragraphs), bulletPoints (4-6 items).

Car details:
${JSON.stringify(car, null, 2)}
`.trim();
}

