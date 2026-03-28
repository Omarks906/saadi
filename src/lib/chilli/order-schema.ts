/**
 * Chilli Pizzeria — structured post-call order schema
 *
 * Three things live here:
 *   1. Zod schemas — runtime validation + coercion
 *   2. Inferred TypeScript types (from Zod)
 *   3. OPENAI_ORDER_SCHEMA — the raw JSON Schema for OpenAI structured outputs
 *      (strict mode: all fields required, no additionalProperties)
 *
 * Keep (1) and (3) in sync manually whenever the shape changes.
 */

import { z } from "zod";

// ── Pizza ─────────────────────────────────────────────────────────────────────

export const PizzaSchema = z.object({
  /** Canonical menu item name, e.g. "Capricciosa". Never invent names. */
  pizzaName: z.string().min(1),

  /** "vanlig" = regular/ordinarie, "family" = family size */
  size: z.enum(["vanlig", "family"]),

  gluten_free: z.boolean(),
  extra_cheese: z.boolean(),
  extra_parmesan: z.boolean(),

  /**
   * Free-text topping modifications expressed as the customer said them.
   * e.g. "half gyros + half kebab", "utan lök", "extra champinjoner"
   * null when no modifications.
   */
  toppingMods: z.string().nullable(),

  /**
   * Non-standard sauce requested by the customer.
   * e.g. "pirri-pirri", "bearnaise", "kebabsås"
   * null when no special sauce.
   */
  sauce: z.string().nullable(),

  /** Customer asked for the pizza to be cut into slices. */
  sliced: z.boolean(),
});

export type Pizza = z.infer<typeof PizzaSchema>;

// ── Drink ─────────────────────────────────────────────────────────────────────

export const DrinkSchema = z.object({
  /** Drink name as recognised from the menu or spoken, e.g. "Coca-Cola Zero" */
  name: z.string().min(1),
  quantity: z.number().int().min(1),
});

export type Drink = z.infer<typeof DrinkSchema>;

// ── Fulfillment ───────────────────────────────────────────────────────────────

export const FulfillmentSchema = z.object({
  type: z.enum(["pickup", "eat-in"]),
});

export type Fulfillment = z.infer<typeof FulfillmentSchema>;

// ── Metadata ─────────────────────────────────────────────────────────────────

export const OrderMetadataSchema = z.object({
  /** Raw phone number as spoken / read from caller-ID. Never guess. */
  customerNumber: z.string().nullable(),

  /** Customer name if explicitly given during the call. Never guess. */
  customerName: z.string().nullable(),

  /**
   * Free-text requests that don't fit elsewhere.
   * e.g. ["no ringing the doorbell", "extra napkins"]
   */
  specialRequests: z.array(z.string()),
});

export type OrderMetadata = z.infer<typeof OrderMetadataSchema>;

// ── Top-level order ───────────────────────────────────────────────────────────

export const ChilliOrderSchema = z.object({
  pizzas: z.array(PizzaSchema),
  drinks: z.array(DrinkSchema),
  fulfillment: FulfillmentSchema,
  metadata: OrderMetadataSchema,
});

export type ChilliOrder = z.infer<typeof ChilliOrderSchema>;

// ── OpenAI structured output JSON Schema ──────────────────────────────────────
//
// Must satisfy OpenAI strict mode:
//   • Every object has additionalProperties: false
//   • Every property listed in the object is also in required[]
//   • Nullable fields use anyOf: [{type: "..."}, {type: "null"}]
//   • Arrays of strings use items: {type: "string"}
//
// Keep this in sync with the Zod schemas above.

export const OPENAI_ORDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pizzas", "drinks", "fulfillment", "metadata"],
  properties: {
    pizzas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "pizzaName",
          "size",
          "gluten_free",
          "extra_cheese",
          "extra_parmesan",
          "toppingMods",
          "sauce",
          "sliced",
        ],
        properties: {
          pizzaName:       { type: "string" },
          size:            { type: "string", enum: ["vanlig", "family"] },
          gluten_free:     { type: "boolean" },
          extra_cheese:    { type: "boolean" },
          extra_parmesan:  { type: "boolean" },
          toppingMods:     { anyOf: [{ type: "string" }, { type: "null" }] },
          sauce:           { anyOf: [{ type: "string" }, { type: "null" }] },
          sliced:          { type: "boolean" },
        },
      },
    },

    drinks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity"],
        properties: {
          name:     { type: "string" },
          quantity: { type: "integer" },
        },
      },
    },

    fulfillment: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["pickup", "eat-in"] },
      },
    },

    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["customerNumber", "customerName", "specialRequests"],
      properties: {
        customerNumber:  { anyOf: [{ type: "string" }, { type: "null" }] },
        customerName:    { anyOf: [{ type: "string" }, { type: "null" }] },
        specialRequests: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

// ── Validation helper ─────────────────────────────────────────────────────────

/**
 * Parse and validate a raw object (e.g. JSON.parse output from the model)
 * against ChilliOrderSchema. Throws a ZodError with a clear message if invalid.
 */
export function parseChilliOrder(raw: unknown): ChilliOrder {
  return ChilliOrderSchema.parse(raw);
}

/**
 * Safe variant — returns { success, data, error } instead of throwing.
 */
export function safeParseChilliOrder(raw: unknown) {
  return ChilliOrderSchema.safeParse(raw);
}
