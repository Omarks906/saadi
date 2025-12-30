import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type AdOut = {
  headline: string;
  short: string;
  body: string;
  bulletPoints: string[];
};

export function buildAdPrompt(car: any, language: "en" | "sv" = "en") {
  const languageInstructions = language === "sv" 
    ? `Skriv en begagnad bilannons på SVENSKA. 
VIKTIGT: Använd ENDAST informationen som finns i biluppgifterna nedan. Hitta INTE på fakta som saknas.
- Om något fält är tomt eller 0, nämn det INTE eller säg att informationen saknas
- Var ärlig och tydlig
- Undvik överdrifter som "bäst", "perfekt", "måste se"
- Om priset saknas, nämn det inte
- Om bränsletyp saknas, nämn det inte
- Om växellåda saknas, nämn det inte`
    : `Write a used-car marketplace ad in ENGLISH.
CRITICAL: Use ONLY the information provided in the car details below. Do NOT invent facts that are missing.
- If a field is empty or 0, do NOT mention it or say the information is not available
- Be honest and clear
- Avoid hype words like "best", "perfect", "must-see"
- If price is missing, do not mention price
- If fuel type is missing, do not mention fuel type
- If transmission is missing, do not mention transmission`;
  
  return `
${languageInstructions}

Return VALID JSON with keys:
headline (<= 70 chars), short (<= 240 chars), body (2 short paragraphs), bulletPoints (4-6 items).

ONLY use information from these car details. Do NOT add any information that is not explicitly provided:
${JSON.stringify(car, null, 2)}
`.trim();
}

