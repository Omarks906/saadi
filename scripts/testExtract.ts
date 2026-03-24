/**
 * Test harness for AI-based order extraction.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx ts-node --project tsconfig.json scripts/testExtract.ts
 *
 * Or with dotenv:
 *   npx ts-node -r dotenv/config --project tsconfig.json scripts/testExtract.ts
 */

import { extractOrderFromTranscript } from "../src/lib/orderExtraction";

const TRANSCRIPTS = [
  {
    label: "Transcript A – Capricciosa halva/halva, hämtar",
    text: "Vi beställde en capricciosa pizza, halva med giro och halva med kebab. Vi hämtar själv.",
  },
  {
    label: "Transcript B – Kabeltjocka vitlökssås, hämtar",
    text: "Jag vill beställa en kabeltjocka vita... vitlökssås och gurka och med chili i såsen. Jag hämtar.",
  },
];

async function main() {
  for (const { label, text } of TRANSCRIPTS) {
    console.log("\n" + "=".repeat(60));
    console.log(`[${label}]`);
    console.log("Transcript:", text);
    try {
      const result = await extractOrderFromTranscript({ transcript: text, languageHint: "sv" });
      console.log("Result:", JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.error("Error:", err?.message || err);
    }
  }
}

main().catch(console.error);
