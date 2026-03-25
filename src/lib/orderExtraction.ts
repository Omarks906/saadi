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

KRITISKA REGLER (bryt aldrig):
- En pizza/maträtt med toppings = EN artikel, inte flera
- "Chili special med pepperoni" = EN pizza med pepperoni-topping
- "Hawaii med extra ost" = EN hawaii-pizza med extra-ost-modifikation
- Skapa ALDRIG separata artiklar för toppings/ingredienser
- Om kunden säger "X med Y" → gör Y till en modifikation på X

Extraktionsregler:
- Extrahera exakt vad kunden beställde — hitta INTE på artiklar
- Använd kundens exakta ord för pizzanamn
- Lägg toppings/tillägg i modifikations-listan, inte som separata items
- Uppskatta konfidens (0-100) per artikel och totalt
- Sätt needs_review=true om konfidens < 70 eller om information saknas
- Detecta pickup vs delivery från kontexten

Exempel:
Input: "Hawaii familjestorlek med extra ost och en Margherita"
Output: 2 items - "Hawaii" (familjestorlek, modifikation: extra ost), "Margherita"

Input: "Chili special med pepperoni på"
Output: 1 item - "Chili special" (modifikation: pepperoni)

Svara alltid på JSON-formatet som specificerats.`;

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
