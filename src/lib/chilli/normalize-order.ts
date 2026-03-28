/**
 * normalize-order.ts
 *
 * Converts a flat AI-extracted item list (from ExtractedOrder.items) into the
 * structured ChilliOrder shape defined in order-schema.ts.
 *
 * Responsibilities:
 *   - Map each item.name through matchPizzaName() (Levenshtein + Dice fuzzy match)
 *   - Separate pizzas from drinks by name heuristics
 *   - Parse per-pizza modifiers (gluten_free, size, sauce, sliced, toppingMods)
 *     from modifications[] and transcript context
 *   - Detect fulfillment ("pickup" | "eat-in") from transcript
 *   - Return an object ready for safeParseChilliOrder() validation
 */

import { matchPizzaName } from "./match-pizza-name";
import { ChilliOrder, Pizza, Drink } from "./order-schema";

// ── Input type ────────────────────────────────────────────────────────────────

export interface RawExtractedItem {
  name: string;
  quantity: number;
  /** Structured modification strings from AI extraction */
  modifications?: string[];
  /** Already-joined description (alternative to modifications[]) */
  description?: string | null;
  /** Notes field from AI extraction */
  notes?: string | null;
}

// ── Drink detection ───────────────────────────────────────────────────────────

const DRINK_PATTERN =
  /coca.?cola|fanta|sprite|pepsi|vatten|lemonad|juice|öl\b|beer|vin\b|wine|mjölk|milk|kaffe|coffee|\bte\b|monster|red\s*bull|läsk|7.?up/i;

function looksLikeDrink(name: string): boolean {
  return DRINK_PATTERN.test(name) && matchPizzaName(name) === null;
}

// ── Modifier extraction ───────────────────────────────────────────────────────

interface ParsedModifiers {
  gluten_free: boolean;
  extra_cheese: boolean;
  extra_parmesan: boolean;
  sliced: boolean;
  size: "vanlig" | "family";
  sauce: string | null;
  toppingMods: string | null;
}

/** Patterns whose presence in a modifier string marks it as "consumed". */
const CONSUMED_PATTERNS: RegExp[] = [
  /glutenfri|gluten.?fri|\bgf\b/i,
  /extra\s*(?:ost|mozzarella|cheese)/i,
  /extra\s*parmesan/i,
  /skär\s+i\s+(?:skivor|slices?)|slajsa|\bslice\b/i,
  /familj(?:e|epizza|storlek)?|vanlig|ordinarie/i,
  /sås\s*[:：]\s*\S+(?:\s+\S+)?|pirri.?pirri|bearnaise|kebab\s*sås|vitlöks\s*sås|aioli|barbecue|bbq/i,
];

/**
 * Parse structured modifier fields from:
 *   - `mods` — the modifications[] array from AI extraction
 *   - `description` — joined notes/description string
 *   - `context` — full transcript (for global signals like "familj" or "glutenfri")
 */
function parseModifiers(
  mods: string[],
  description: string | null,
  context: string,
): ParsedModifiers {
  const combined = [...mods, description ?? ""].join(" ");

  const gluten_free =
    /glutenfri|gluten.?fri|\bgf\b/i.test(combined) ||
    /glutenfri|gluten.?fri/i.test(context);

  const extra_cheese = /extra\s*(?:ost|mozzarella|cheese)/i.test(combined);

  const extra_parmesan = /extra\s*parmesan/i.test(combined);

  const sliced =
    /skär\s+i\s+(?:skivor|slices?)|slajsa|\bslice\b/i.test(combined) ||
    /skär\s+i\s+(?:skivor|slices?)|slajsa/i.test(context);

  const size: "vanlig" | "family" =
    /familj(?:e|epizza|storlek)?/i.test(combined) ||
    /familj(?:e|epizza|storlek)?/i.test(context)
      ? "family"
      : "vanlig";

  // Sauce: "sås: X" pattern takes priority, then known sauce names
  let sauce: string | null = null;
  const explicitSauce = combined.match(/sås\s*[:：]\s*(\S+(?:\s+\S+)?)/i);
  if (explicitSauce) {
    sauce = explicitSauce[1].trim();
  } else {
    const knownSauce = combined.match(
      /\b(pirri.?pirri|bearnaise|kebab\s*sås|vitlöks\s*sås|aioli|barbecue|bbq)\b/i,
    );
    if (knownSauce) sauce = knownSauce[1].trim();
  }

  // toppingMods: modification strings left after stripping recognised signals
  const remaining = mods
    .map((mod) => {
      let s = mod;
      for (const p of CONSUMED_PATTERNS) s = s.replace(p, "").replace(/\s{2,}/g, " ").trim();
      return s;
    })
    .filter(Boolean);
  const toppingMods = remaining.length ? remaining.join(", ") : null;

  return { gluten_free, extra_cheese, extra_parmesan, sliced, size, sauce, toppingMods };
}

// ── Fulfillment detection ─────────────────────────────────────────────────────

function detectFulfillment(
  transcript: string,
  extractedFulfillment?: string,
): "pickup" | "eat-in" {
  if (
    /äta\s+här|äter\s+här|sitter\s+här|dine.?in|eat.?in|sitta\s+här|\binne\b/i.test(
      transcript,
    )
  ) {
    return "eat-in";
  }
  // AI-extracted "delivery" → "pickup" (this restaurant is pickup/eat-in only)
  if (extractedFulfillment === "pickup") return "pickup";
  return "pickup"; // safe default
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Build a human-readable description string from a structured Pizza object,
 * suitable for the flat DB items[].description field.
 *
 * @example buildPizzaDescription(pizza) → "familj, glutenfri, sås: pirri-pirri, skär i skivor"
 */
export function buildPizzaDescription(pizza: Pizza): string | undefined {
  const parts: string[] = [];
  if (pizza.size === "family") parts.push("familj");
  if (pizza.gluten_free) parts.push("glutenfri");
  if (pizza.extra_cheese) parts.push("extra ost");
  if (pizza.extra_parmesan) parts.push("extra parmesan");
  if (pizza.sauce) parts.push(`sås: ${pizza.sauce}`);
  if (pizza.sliced) parts.push("skär i skivor");
  if (pizza.toppingMods) parts.push(pizza.toppingMods);
  return parts.length ? parts.join(", ") : undefined;
}

// ── Core normalizer ───────────────────────────────────────────────────────────

/**
 * Convert a flat AI-extracted item list to a structured ChilliOrder.
 *
 * The returned object is NOT yet Zod-validated. Pass it to
 * `safeParseChilliOrder(result)` to validate and get a typed `ChilliOrder`.
 *
 * @param items               - Items from AI extraction (ExtractedOrder.items)
 * @param transcript          - Full call transcript (original or Whisper re-transcription)
 * @param extractedFulfillment - Fulfillment detected by AI ("pickup" | "delivery" | "unknown")
 */
export function normalizeToChilliOrder(
  items: RawExtractedItem[],
  transcript: string,
  extractedFulfillment?: string,
): ChilliOrder {
  const pizzas: Pizza[] = [];
  const drinks: Drink[] = [];

  for (const item of items) {
    const name = item.name?.trim();
    if (!name) continue;

    const mods = item.modifications ?? [];
    const description =
      item.description ?? (item.notes != null ? String(item.notes) : null);
    const qty = Math.max(1, item.quantity || 1);

    if (looksLikeDrink(name)) {
      drinks.push({ name, quantity: qty });
      continue;
    }

    // Fuzzy-match pizza name; fall back to raw name so we never drop an item
    const pizzaName = matchPizzaName(name) ?? name;
    const modifiers = parseModifiers(mods, description, transcript);

    // Represent quantity as N separate pizza objects (one per kitchen ticket line)
    for (let i = 0; i < qty; i++) {
      pizzas.push({ pizzaName, ...modifiers });
    }
  }

  return {
    pizzas,
    drinks,
    fulfillment: { type: detectFulfillment(transcript, extractedFulfillment) },
    metadata: {
      customerNumber: null,
      customerName: null,
      specialRequests: [],
    },
  };
}
