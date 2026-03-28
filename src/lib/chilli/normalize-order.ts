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

/**
 * Returns true for non-pizza food items: pasta dishes, salads, grill items, etc.
 * These must never receive pizza-specific modifiers (size, sauce, sliced).
 *
 * "\bpasta\b" is the strongest signal — "Bolognese pasta" is a pasta dish even
 * though "Bolognese" is also a pizza name.
 */
function looksLikeNonPizzaFood(name: string): boolean {
  if (/\bpasta\b/i.test(name)) return true;
  // Salads/grill/sides that are clearly not pizzas and don't match the pizza menu
  return (
    /\bsallad\b|\bschnitzel\b|\bbiff\s+med\b|\bgrillad?\s+(?:kyckling|lax)\b|\bkebabtallrik\b|\bfalafeltallrik\b/i.test(name) &&
    matchPizzaName(name) === null
  );
}

/**
 * Returns true if `name` appears directly adjacent to "pasta" in the transcript.
 *
 * Catches cases where the Vapi AI drops the "pasta" suffix from item names in
 * structured output (e.g. "Bolognese pasta" → "Bolognese"), so the item would
 * otherwise be mistaken for the Bolognese pizza.
 */
function appearsAsPastaInTranscript(name: string, transcript: string): boolean {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`\\b${esc}\\s+pasta\\b`, "i").test(transcript) ||
    new RegExp(`\\bpasta\\s+${esc}\\b`, "i").test(transcript)
  );
}

// ── Modifier-only item detection + merge ──────────────────────────────────────

/**
 * Returns true if the item name is a pure modifier token (size, sauce, sliced,
 * gluten-free) that the Vapi AI produced as a separate flat item instead of
 * nesting it inside the pizza object.
 *
 * Examples: "vanlig storlek", "Peri Peri sås", "slajsad", "glutenfri"
 */
function isModifierOnlyItem(name: string): boolean {
  const n = name.toLowerCase().trim().replace(/[()]/g, "").trim();
  // Size-only tokens (Swedish: vanlig = regular, storlek = size)
  if (/^(vanlig|normal|family|stor|liten)\s*(storlek|size|pizza)?$/.test(n)) return true;
  // Known sauce names with optional "sås/sauce" suffix
  if (
    /^(piri\s*piri|peri\s*peri|piripiri|pirri\s*pirri|kebab|vitlök|tomat|grädde|bearnaise|curry|tikka|bbq|jalapeño|jalapeno|aioli|barbecue)\s*(s[åa]s|sauce)?$/.test(n)
  )
    return true;
  // Any "X sås" that isn't a pizza name
  if (/^.+\s+s[åa]s$/.test(n) && !/\bpizza\b/.test(n)) return true;
  // Sliced tokens
  if (/^(slajsad[)]*|sliced|skivad|skär|slafsad)$/.test(n)) return true;
  // Gluten-free tokens
  if (/^gluten[\s-]*fri(tt|t)?$/.test(n) || /^gluten-?free$/.test(n)) return true;
  // Extra topping tokens
  if (/^extra\s+(ost|parmesan|cheese|mozzarella)$/.test(n)) return true;
  return false;
}

/**
 * Merge consecutive modifier-only items into the preceding item's description.
 *
 * Vapi's structured-output AI often produces a flat list where each modifier
 * is a separate entry, e.g.:
 *   ["Tropicana", "glutenfri", "slajsad", "Coca-Cola"]
 * which becomes:
 *   [{ name: "Tropicana", description: "glutenfri, slajsad" }, { name: "Coca-Cola" }]
 *
 * The reassembled list can then be passed to normalizeToChilliOrder() which reads
 * modifiers from item.description and assigns them per-pizza correctly.
 */
export function mergeModifierItems(items: RawExtractedItem[]): RawExtractedItem[] {
  const result: RawExtractedItem[] = [];
  for (const item of items) {
    const name = item.name?.trim() ?? "";
    if (isModifierOnlyItem(name) && result.length > 0) {
      const last = result[result.length - 1];
      last.description = [last.description ?? "", name].filter(Boolean).join(", ");
    } else {
      result.push({ ...item });
    }
  }
  return result;
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

// ── Core-name extractor ───────────────────────────────────────────────────────

/**
 * Strip modifier language baked into an AI item name and return the core
 * pizza name plus any modifiers that were embedded in the name string.
 *
 * AI extraction frequently outputs compound names like:
 *   "gluten-free family size Hawaii pizza with piripiri sauce (sliced)"
 * instead of separating the modifiers into modifications[].
 *
 * After stripping, the core name is short enough for matchPizzaName() to
 * identify the correct menu item without modifier words poisoning the score.
 *
 * @example
 *   "gluten-free family size Hawaii pizza with piripiri sauce (sliced)"
 *   → { coreName: "Hawaii", nameModifiers: ["glutenfri","familj","sås: piripiri","skär i skivor"] }
 */
function extractCoreNameAndModifiers(raw: string): {
  coreName: string;
  nameModifiers: string[];
} {
  const nameModifiers: string[] = [];

  if (/gluten.?fri|gluten.?free/i.test(raw))                    nameModifiers.push("glutenfri");
  if (/familj(?:e|estorlek|epizza)?|family\s*size/i.test(raw))  nameModifiers.push("familj");
  if (/vanlig|ordinarie|normal\s*(?:size|storlek)/i.test(raw))  nameModifiers.push("vanlig");
  if (/skivad[et]?|\bsliced?\b|skär\s+i\s+skivor/i.test(raw))   nameModifiers.push("skär i skivor");
  if (/extra\s*parmesan/i.test(raw))                            nameModifiers.push("extra parmesan");
  if (/extra\s*(?:ost|mozzarella|cheese)/i.test(raw))           nameModifiers.push("extra ost");

  // Capture sauce embedded as "med X sås" or "with X sauce" or a known sauce name
  const sauceInName =
    raw.match(/\bmed\s+(\w+(?:[\s-]\w+)?)\s*sås\b/i) ||
    raw.match(/\bwith\s+(\w+(?:[\s-]\w+)?)\s*sauce\b/i) ||
    raw.match(/\b(piripiri|pirri.?pirri|bearnaise|kebab\s*sås|vitlöks\s*sås|aioli|barbecue|bbq)\b/i);
  if (sauceInName) nameModifiers.push(`sås: ${sauceInName[1].trim()}`);

  // Strip all modifier language from the name to isolate the pizza name
  const core = raw
    .replace(/gluten.?fri[t]?|gluten.?free/gi, "")
    .replace(/familje?(?:storlek|pizza|size)?|family\s*size/gi, "")
    .replace(/vanlig|ordinarie|normal\s*(?:size|storlek)/gi, "")
    .replace(/\bmed\s+\w+(?:[\s-]\w+)?\s*sås\b/gi, "")
    .replace(/\bwith\s+\w+(?:[\s-]\w+)?\s*sauce\b/gi, "")
    .replace(/\bpiripiri\b|\bpirri.?pirri\b|\bbearnaise\b|\bkebab\s*sås\b|\bvitlöks\s*sås\b|\baioli\b|\bbarbecue\b|\bbbq\b/gi, "")
    .replace(/\(?skivad[et]?\)?|\(?sliced?\)?|skär\s+i\s+skivor/gi, "")
    .replace(/extra\s*(?:ost|mozzarella|cheese|parmesan)/gi, "")
    .replace(/\bmed\b|\bwith\b|\bsize\b|\bstorlek\b/gi, "")
    // Remove trailing/standalone "pizza" word — menu item names don't use it as a suffix
    // (compound names like "Kycklingpizza" are handled by matchPizzaName on the full name)
    .replace(/\bpizza\b/gi, "")
    .replace(/[()]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { coreName: core, nameModifiers };
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
  const otherItems: Array<{ name: string; quantity: number }> = [];

  for (const item of items) {
    const name = item.name?.trim();
    if (!name) continue;

    const mods = item.modifications ?? [];
    const description =
      item.description ?? (item.notes != null ? String(item.notes) : null);
    const qty = Math.max(1, item.quantity || 1);

    // ── Drinks ──────────────────────────────────────────────────────────────
    if (looksLikeDrink(name)) {
      drinks.push({ name, quantity: qty });
      continue;
    }

    // ── Non-pizza food (pasta, salads, grill) ────────────────────────────────
    // Keep as-is; never apply pizza modifiers (size/sauce/sliced) to them.
    if (looksLikeNonPizzaFood(name)) {
      otherItems.push({ name, quantity: qty });
      continue;
    }

    // ── Transcript-context pasta detection ───────────────────────────────────
    // Catches "Bolognese" (Vapi AI dropped "pasta") when transcript has "Bolognese pasta".
    if (transcript && appearsAsPastaInTranscript(name, transcript)) {
      otherItems.push({ name, quantity: qty });
      continue;
    }

    // ── Pizza ────────────────────────────────────────────────────────────────
    // Strip modifier language baked into the item name (AI often produces compound
    // names like "gluten-free family Hawaii pizza with piripiri sauce (sliced)").
    // Match on the stripped core first so modifier words don't poison the fuzzy score.
    const { coreName, nameModifiers } = extractCoreNameAndModifiers(name);

    // Match priority: stripped core name → full raw name → cleaned name → raw name
    const matchedName =
      (coreName ? matchPizzaName(coreName) : null) ??
      matchPizzaName(name) ??
      null;
    const pizzaName = matchedName ?? (coreName || name);

    // Merge modifiers found in the name with explicit modifications[]
    const modifiers = parseModifiers([...nameModifiers, ...mods], description, transcript);

    // Represent quantity as N separate pizza objects (one per kitchen ticket line)
    for (let i = 0; i < qty; i++) {
      pizzas.push({ pizzaName, ...modifiers });
    }
  }

  return {
    pizzas,
    drinks,
    otherItems,
    fulfillment: { type: detectFulfillment(transcript, extractedFulfillment) },
    metadata: {
      customerNumber: null,
      customerName: null,
      specialRequests: [],
    },
  };
}

// ── Structured-output item name normalizer ────────────────────────────────────

/**
 * Apply pizza-name fuzzy matching to a single raw item name.
 * Used in the structured-output path where full normalizeToChilliOrder
 * doesn't run but item names still benefit from canonical name resolution.
 *
 * Returns the canonical menu name if matched, or the original name unchanged.
 * Never returns null — safe to call on any item (drinks, pasta, etc.).
 *
 * @example
 *   normalizeSingleItemName("Tropicana pizza") → "Tropicana"
 *   normalizeSingleItemName("Capricciosa pizza") → "Capricciosa"
 *   normalizeSingleItemName("Carbonara pasta")   → "Carbonara pasta"  (no match → unchanged)
 *   normalizeSingleItemName("Coca-Cola Zero")     → "Coca-Cola Zero"  (no match → unchanged)
 */
export function normalizeSingleItemName(rawName: string): string {
  if (!rawName?.trim()) return rawName;
  const name = rawName.trim();
  const { coreName } = extractCoreNameAndModifiers(name);
  const matched =
    (coreName ? matchPizzaName(coreName) : null) ??
    matchPizzaName(name);
  return matched ?? rawName;
}
