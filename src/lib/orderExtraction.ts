import OpenAI from "openai";
import { PIZZA_MENU_NAMES } from "./chilli/match-pizza-name";

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

// Build a compact menu string at module load time (cheap — runs once).
const _PIZZA_MENU_LINE = PIZZA_MENU_NAMES.join(", ");

const SYSTEM_PROMPT = `Du är ett AI-system som extraherar matbeställningar från telefonsamtalsutskrifter för Chilli Pizzeria.

PIZZA-MENY (exakta tillåtna pizzanamn):
${_PIZZA_MENU_LINE}

Pasta, sallader och andra rätter utöver pizza ska extraheras med deras korrekta namn (t.ex. "Carbonara pasta", "Bolognese pasta").
Drycker extraheras med sitt vanliga namn (t.ex. "Coca-Cola Zero", "Fanta apelsin").

KRITISKA REGLER (bryt aldrig):
- En pizza/maträtt med toppings = EN artikel, inte flera
- "Chili special med pepperoni" = EN pizza med pepperoni-topping
- "Hawaii med extra ost" = EN hawaii-pizza med extra-ost-modifikation
- Skapa ALDRIG separata artiklar för toppings/ingredienser
- Om kunden säger "X med Y" → gör Y till en modifikation på X
- Namnge pizzor med EXAKT det menynamn som bäst matchar vad kunden sa

Extraktionsregler:
- Mappa alltid pizzanamn till närmaste namn i pizza-menyn ovan
- Kunden kan uttala pizzanamn på svenska/dialekt — matcha ändå till menyn
  Exempel: "pizza värld" → "Pizza Verde", "pizza grön" → "Pizza Verde",
           "tropicana" → "Tropicana", "carbonara" → om pasta → "Carbonara pasta"
- Lägg toppings/tillägg i modifikations-listan, inte som separata items
- Uppskatta konfidens (0-100) per artikel och totalt
- Sätt needs_review=true om konfidens < 70 eller om information saknas
- Detecta pickup vs delivery från kontexten

Exempel:
Input: "Hawaii familjestorlek med extra ost och en Margherita"
Output: 2 items - "Hawaii" (familjestorlek, modifikation: extra ost), "Margherita"

Input: "Pizza verde familj med pirri pirri sås, skiva den"
Output: 1 item - "Pizza Verde" (modifikation: familjestorlek, pirri pirri sås, skivad)

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
