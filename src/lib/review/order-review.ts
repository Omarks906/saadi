import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export type ReviewResult = {
  final_extraction_json: any;
  changes: Array<{ field: string; from: any; to: any; reason: string }>;
  overall_confidence: number;
  needs_human_review: boolean;
  review_notes: string;
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    // Must match the same shape as the initial extraction (ExtractedOrder)
    final_extraction_json: {
      type: "object",
      properties: {
        fulfillment: { type: "string", enum: ["pickup", "delivery", "unknown"] },
        address: { anyOf: [{ type: "string" }, { type: "null" }] },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "integer" },
              modifications: { type: "array", items: { type: "string" } },
              notes: { anyOf: [{ type: "string" }, { type: "null" }] },
              confidence: { type: "integer" },
            },
            required: ["name", "quantity", "modifications", "notes", "confidence"],
            additionalProperties: false,
          },
        },
        overall_confidence: { type: "integer" },
        needs_review: { type: "boolean" }
      },
      required: ["fulfillment", "address", "items", "overall_confidence", "needs_review"],
      additionalProperties: false,
    },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          from: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "null" }] },
          to: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "null" }] },
          reason: { type: "string" },
        },
        required: ["field", "from", "to", "reason"],
        additionalProperties: false,
      },
    },
    overall_confidence: { type: "integer" },
    needs_human_review: { type: "boolean" },
    review_notes: { type: "string" },
  },
  required: [
    "final_extraction_json",
    "changes",
    "overall_confidence",
    "needs_human_review",
    "review_notes",
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a meticulous post-call order review assistant for a pizzeria.

You receive:
- an original transcript
- an audio-based transcript (re-transcribed from the recording)
- an initial extracted order JSON

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER turn toppings into separate items
- "Pizza X med Y" = ONE item (X with Y as modification), not TWO items
- If transcript says "Chili special med pepperoni", output ONE "Chili special" item with pepperoni as modification
- Validate: item count in output should match item mentions in transcript
- If initial extraction split toppings incorrectly, fix it by merging back into base items

Your job:
- Correct the extracted order based on evidence in the transcripts.
- Prefer the audio-based transcript if they conflict.
- Never invent missing details.
- If critical details are unclear/missing, set needs_human_review=true and explain briefly.

The field final_extraction_json MUST use the same structure as the initial extraction JSON (fulfillment/address/items/overall_confidence/needs_review).
If you change anything inside final_extraction_json, include a corresponding entry in changes[].

Critical details include: item names, quantities, family size, half/half, sauces, drinks, pickup vs delivery, and delivery address.
Return ONLY JSON that matches the provided schema.`;

export async function reviewExtractedOrder(args: {
  languageHint?: "sv" | "en";
  originalTranscript: string;
  audioTranscript: string;
  initialExtractionJson: any;
}): Promise<ReviewResult> {
  const client = getClient();
  const model = process.env.OPENAI_REVIEW_MODEL || "gpt-5.2";

  const lang = args.languageHint === "en" ? "English" : "Swedish";

  const userContent = {
    language: lang,
    original_transcript: args.originalTranscript,
    audio_transcript: args.audioTranscript,
    initial_extraction_json: args.initialExtractionJson,
  };

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userContent) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "order_review_result",
        strict: true,
        schema: REVIEW_SCHEMA as any,
      },
    },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Review model returned empty content");
  return JSON.parse(content) as ReviewResult;
}
