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
 * Returns text and source information
 */
function extractTextFromEvent(event: any): { text: string; source: string } {
  const textParts: string[] = [];
  let source = "unknown";

  // Check transcript if available (highest priority)
  if (event.call?.transcript) {
    textParts.push(event.call.transcript);
    source = "call.transcript";
  } else if (event.transcript) {
    textParts.push(event.transcript);
    source = "transcript";
  }

  // Check summary if available
  if (event.call?.summary) {
    textParts.push(event.call.summary);
    if (source === "unknown") {
      source = "call.summary";
    }
  } else if (event.summary) {
    textParts.push(event.summary);
    if (source === "unknown") {
      source = "summary";
    }
  }

  // Check metadata
  if (event.call?.metadata && typeof event.call.metadata === "object") {
    textParts.push(JSON.stringify(event.call.metadata));
    if (source === "unknown") {
      source = "metadata";
    }
  } else if (event.metadata && typeof event.metadata === "object") {
    textParts.push(JSON.stringify(event.metadata));
    if (source === "unknown") {
      source = "metadata";
    }
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

  return {
    text: textParts.join(" ").toLowerCase(),
    source: source,
  };
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
 * Detection result with metadata
 */
export type BusinessTypeDetection = {
  businessType: "car" | "restaurant" | "router";
  carHits: number;
  restaurantHits: number;
  detectedFrom: string;
  confidence: number;
};

/**
 * Determine business type based on keyword analysis
 * Returns business type with hit counts and confidence
 */
export function detectBusinessTypeFromCall(event: any): BusinessTypeDetection {
  const { text, source } = extractTextFromEvent(event);

  if (!text || text.trim().length === 0) {
    return {
      businessType: "router",
      carHits: 0,
      restaurantHits: 0,
      detectedFrom: "unknown",
      confidence: 0,
    };
  }

  const carHits = countKeywordMatches(text, CAR_KEYWORDS);
  const restaurantHits = countKeywordMatches(text, RESTAURANT_KEYWORDS);
  const confidence = Math.abs(carHits - restaurantHits);

  // Decision rule:
  // If car hits > restaurant hits → car
  // If restaurant hits > car hits → restaurant
  // Else → router
  let businessType: "car" | "restaurant" | "router";
  if (carHits > restaurantHits) {
    businessType = "car";
  } else if (restaurantHits > carHits) {
    businessType = "restaurant";
  } else {
    businessType = "router";
  }

  return {
    businessType,
    carHits,
    restaurantHits,
    detectedFrom: source,
    confidence,
  };
}

