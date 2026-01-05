/**
 * Business type detection based on keyword matching
 * Analyzes call content to determine if it's a car or restaurant call
 */

const CAR_KEYWORDS = [
  // English
  "car",
  "vehicle",
  "blocket",
  "listing",
  "ad",
  "sell",
  "buy",
  "price",
  "mileage",
  "mil",
  "service",
  "registration",
  // Swedish
  "bil",
  "fordon",
  "annons",
  "sälja",
  "köpa",
  "pris",
  "miltal",
  "årsmodell",
  "besiktning",
  "växellåda",
  "automat",
  "manuell",
];

const RESTAURANT_KEYWORDS = [
  // English
  "pizza",
  "restaurant",
  "order",
  "delivery",
  "pickup",
  "menu",
  "table",
  "booking",
  "open",
  "hours",
  "address",
  // Swedish
  "pizza",
  "restaurang",
  "beställ",
  "beställa",
  "leverans",
  "hämtning",
  "meny",
  "boka",
  "bord",
  "öppet",
  "öppettider",
  "adress",
];

/**
 * Extract text content from call event for analysis
 */
function extractTextFromEvent(event: any): string {
  const textParts: string[] = [];

  // Check transcript if available
  if (event.transcript) {
    textParts.push(event.transcript);
  }
  if (event.call?.transcript) {
    textParts.push(event.call.transcript);
  }

  // Check metadata
  if (event.metadata && typeof event.metadata === "object") {
    textParts.push(JSON.stringify(event.metadata));
  }
  if (event.call?.metadata && typeof event.call.metadata === "object") {
    textParts.push(JSON.stringify(event.call.metadata));
  }

  // Check phone numbers (could indicate business type)
  if (event.call?.from) {
    textParts.push(event.call.from);
  }
  if (event.call?.to) {
    textParts.push(event.call.to);
  }
  if (event.phoneNumber) {
    textParts.push(event.phoneNumber);
  }

  // Check any other text fields
  if (event.message) {
    textParts.push(event.message);
  }
  if (event.call?.message) {
    textParts.push(event.call.message);
  }

  return textParts.join(" ").toLowerCase();
}

/**
 * Count keyword matches in text
 */
function countKeywordMatches(text: string, keywords: string[]): number {
  let count = 0;
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    // Use word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Determine business type based on keyword analysis
 * Returns "car", "restaurant", or "router"
 */
export function detectBusinessTypeFromCall(event: any): "car" | "restaurant" | "router" {
  const text = extractTextFromEvent(event);

  if (!text || text.trim().length === 0) {
    return "router";
  }

  const carHits = countKeywordMatches(text, CAR_KEYWORDS);
  const restaurantHits = countKeywordMatches(text, RESTAURANT_KEYWORDS);

  // Decision rule:
  // If car hits > restaurant hits → car
  // If restaurant hits > car hits → restaurant
  // Else → router
  if (carHits > restaurantHits) {
    return "car";
  } else if (restaurantHits > carHits) {
    return "restaurant";
  } else {
    return "router";
  }
}

