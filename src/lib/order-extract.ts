import { getMenuNamesForExtraction, getMenuItemByName } from "./chilli/menu";

export type ExtractedOrder = {
  items: Array<{
    name: string;
    qty: number;
    size?: "ordinarie" | "familj";
    glutenFree?: boolean;
    mozzarella?: boolean;
    notes?: string;
    price?: number;
    category?: string;
  }>;
  fulfillment?: "pickup" | "delivery";
  requestedTime?: string; // keep raw; you can normalize later
  customerPhone?: string;
  address?: string;
  rawText: string;
  confidence: number; // 0..1
  estimatedTotal?: number;
};

// Get menu names from the comprehensive Chilli menu
const MENU_ITEMS = getMenuNamesForExtraction();

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWord(haystack: string, needle: string) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-zåäö0-9])${escaped}([^a-zåäö0-9]|$)`, "i");
  return re.test(haystack);
}

function detectFulfillment(t: string): "pickup" | "delivery" | undefined {
  const s = norm(t);
  if (/(hemkörning|leverans|delivery|kör ut|till adress|hem till)/i.test(s)) {
    return "delivery";
  }
  if (/(avhämtning|hämtar|pickup|takeaway|take away|hämta)/i.test(s)) {
    return "pickup";
  }
  return undefined;
}

function detectRequestedTime(t: string): string | undefined {
  const s = norm(t);

  // "kl 18", "18:30", "klockan 17"
  const m1 = s.match(/(?:kl\.?|klockan)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
  if (m1) return m1[2] ? `${m1[1]}:${m1[2]}` : `${m1[1]}:00`;

  const m2 = s.match(/(^|\s)(\d{1,2})[:.](\d{2})(\s|$)/);
  if (m2) return `${m2[2]}:${m2[3]}`;

  // "om 20 minuter"
  const m3 = s.match(/om\s+(\d{1,3})\s*(min|minuter)/i);
  if (m3) return `in ${m3[1]} minutes`;

  return undefined;
}

function detectSize(t: string): "ordinarie" | "familj" | undefined {
  const s = norm(t);
  if (/(familj|familje)/i.test(s)) return "familj";
  if (/(ordinarie|vanlig)/i.test(s)) return "ordinarie";
  return undefined;
}

function detectToggles(t: string) {
  const s = norm(t);
  return {
    glutenFree: /(glutenfri|gluten free)/i.test(s),
    mozzarella: /(mozzarella)/i.test(s),
  };
}

function detectQtyNearby(t: string, item: string): number {
  const s = norm(t);

  // numeric before
  const re1 = new RegExp(`(\\d{1,2})\\s+${item.replace(/ /g, "\\s+")}`, "i");
  const m1 = s.match(re1);
  if (m1) return Math.max(1, Math.min(99, parseInt(m1[1], 10)));

  // numeric after
  const re2 = new RegExp(`${item.replace(/ /g, "\\s+")}\\s*(x|\\*)\\s*(\\d{1,2})`, "i");
  const m2 = s.match(re2);
  if (m2) return Math.max(1, Math.min(99, parseInt(m2[2], 10)));

  // Swedish words (simple)
  if (new RegExp(`${item.replace(/ /g, "\\s+")}.*\\b(två|tva)\\b`, "i").test(s)) {
    return 2;
  }
  if (new RegExp(`${item.replace(/ /g, "\\s+")}.*\\b(tre)\\b`, "i").test(s)) {
    return 3;
  }

  return 1;
}

export function extractOrderFromTranscript(transcript: string): ExtractedOrder {
  const rawText = transcript || "";
  const t = norm(rawText);

  const fulfillment = detectFulfillment(t);
  const requestedTime = detectRequestedTime(t);
  const size = detectSize(t);
  const { glutenFree, mozzarella } = detectToggles(t);

  const items: ExtractedOrder["items"] = [];
  let estimatedTotal = 0;

  for (const name of MENU_ITEMS) {
    if (containsWord(t, name)) {
      const qty = detectQtyNearby(t, name);
      const menuItem = getMenuItemByName(name);

      // Calculate price based on size
      let price: number | undefined;
      if (menuItem) {
        price = size === "familj" && menuItem.priceFamilj
          ? menuItem.priceFamilj
          : menuItem.priceOrdinarie;
        estimatedTotal += price * qty;
      }

      items.push({
        name: menuItem?.name || name, // Use proper casing from menu
        qty,
        size,
        glutenFree: glutenFree || undefined,
        mozzarella: mozzarella || undefined,
        price,
        category: menuItem?.category,
      });
    }
  }

  // Confidence: simple heuristic
  const confidence = items.length === 0 ? 0 : items.length === 1 ? 0.65 : 0.8;

  return {
    items,
    fulfillment,
    requestedTime,
    rawText,
    confidence,
    estimatedTotal: estimatedTotal > 0 ? estimatedTotal : undefined,
  };
}
