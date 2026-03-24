import OpenAI from "openai";

export type ExtractedOrder = {
  fulfillment: "pickup" | "delivery" | "unknown";
  address?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    modifications: string[];
    notes?: string | null;
    confidence: number; // 0-100
  }>;
  overall_confidence: number; // 0-100
  needs_review: boolean;
};

/**
 * JSON Schema for OpenAI Structured Outputs (strict mode).
 * All properties must be in `required`; nullable fields use `anyOf`.
 */
const ORDER_JSON_SCHEMA = {
  type: "object",
  properties: {
    fulfillment: {
      type: "string",
      enum: ["pickup", "delivery", "unknown"],
    },
    address: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "integer" },
          modifications: {
            type: "array",
            items: { type: "string" },
          },
          notes: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          confidence: { type: "integer" },
        },
        required: ["name", "quantity", "modifications", "notes", "confidence"],
        additionalProperties: false,
      },
    },
    overall_confidence: { type: "integer" },
    needs_review: { type: "boolean" },
  },
  required: ["fulfillment", "address", "items", "overall_confidence", "needs_review"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Du är ett AI-system som extraherar matbeställningar från telefonsamtalsutskrifter.

Regler:
- Extrahera beställda maträtter och drycker som de uttalades av kunden
- Hitta INTE på rätter — använd kundens exakta ord och sänk konfidens om det är oklart
- Om kunden säger "halva med X och halva med Y", lägg till modifikationer på rätten
- Uppskatta konfidens (0-100) per artikel och totalt
- Sätt needs_review=true om konfidens < 70 eller om information saknas
- Detecta huruvida kunden hämtar (pickup) eller vill ha hemkörning (delivery)
- Om leveransadress nämns, extrahera den

Svara alltid på JSON-formatet som specificerats, oavsett om transkriptet är på svenska eller engelska.`;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function extractOrderFromTranscript(args: {
  transcript: string;
  languageHint?: "sv" | "en";
}): Promise<ExtractedOrder> {
  const { transcript, languageHint = "sv" } = args;

  const langNote =
    languageHint === "sv"
      ? "Transkriptet är på svenska."
      : "The transcript is in English.";

  const client = getClient();

  const response = await client.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${langNote}\n\nTranskript:\n${transcript}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "extracted_order",
        strict: true,
        schema: ORDER_JSON_SCHEMA,
      },
    },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  const parsed = JSON.parse(content) as ExtractedOrder;
  return parsed;
}
