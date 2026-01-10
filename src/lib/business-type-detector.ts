/**
 * Business type detection based on scoring system
 * Analyzes call content to determine business type using normalized scores
 */

import { BusinessType } from "./vapi-assistant-map";

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

const STRONG = 0.70;
const MARGIN = 0.15;

const SWITCH_STRONG = 0.85;
const SWITCH_MARGIN = 0.20;

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
 * Normalize hit counts to scores (0-1 range)
 * Formula: score = min(1, hits / min(6, keywordCount))
 */
function normalizeHitsToScore(hits: number, keywordCount: number): number {
  if (hits === 0) return 0;
  const divisor = Math.min(6, keywordCount);
  return Math.min(1, hits / divisor);
}

/**
 * Calculate scores for each business type
 */
function calculateScores(text: string): Record<"restaurant" | "car" | "other", number> {
  const carHits = countKeywordMatches(text, CAR_KEYWORDS);
  const restaurantHits = countKeywordMatches(text, RESTAURANT_KEYWORDS);

  const carScore = normalizeHitsToScore(carHits, CAR_KEYWORDS.length);
  const restaurantScore = normalizeHitsToScore(restaurantHits, RESTAURANT_KEYWORDS.length);

  // Don't let "other" dominate early; keep it neutral during the call
  const otherScore = 0;

  return { car: carScore, restaurant: restaurantScore, other: otherScore };
}

/**
 * Decide business type from scores
 */
function decideType(
  scores: Record<"restaurant" | "car" | "other", number>,
  options?: { allowOther?: boolean }
): BusinessType {
  const filteredScores: Record<string, number> = { ...scores };
  if (!options?.allowOther) delete filteredScores.other;

  const sorted = Object.entries(filteredScores).sort((a, b) => b[1] - a[1]);
  const [topType, top] = sorted[0] as [string, number];
  const second = (sorted[1]?.[1] ?? 0) as number;

  const acceptStrong = top >= STRONG;
  const acceptMargin = (top - second) >= MARGIN;

  if (acceptStrong || acceptMargin) return topType as BusinessType;
  return "router";
}

/**
 * Determine if we should switch from current type to next type
 */
export function shouldSwitch(
  current: BusinessType,
  next: BusinessType,
  scores: Record<"restaurant" | "car" | "other", number>
): boolean {
  if (current === "router") return true;
  if (current === next) return false;

  // Only allow switching between car/restaurant if extremely strong
  if (
    (current === "restaurant" && next === "car") ||
    (current === "car" && next === "restaurant")
  ) {
    const sorted = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
    const [topType, top] = sorted[0] as [string, number];
    const second = (sorted[1] as [string, number])[1];

    return topType === next && top >= SWITCH_STRONG && top - second >= SWITCH_MARGIN;
  }

  // Don't downgrade to router/other once locked
  if (next === "router" || next === "other") return false;

  return true;
}

/**
 * Detection result with scores and metadata
 */
export type BusinessTypeDetection = {
  businessType: BusinessType;
  scores: Record<"restaurant" | "car" | "other", number>;
  detectedFrom: string;
  confidence: number; // Difference between top and second score
};

/**
 * Determine business type based on scoring system
 * Returns business type with scores and confidence
 */
export function detectBusinessTypeFromCall(event: any): BusinessTypeDetection {
  const { text, source } = extractTextFromEvent(event);

  if (!text || text.trim().length === 0) {
    return {
      businessType: "router",
      scores: { car: 0, restaurant: 0, other: 1 },
      detectedFrom: "unknown",
      confidence: 0,
    };
  }

  const scores = calculateScores(text);
  
  // If text is too short, return router
  if (text.trim().length < 20) {
    return {
      businessType: "router",
      scores,
      detectedFrom: source,
      confidence: 0,
    };
  }
  
  // Extract eventType from event to determine if "other" is allowed
  const eventType = event.type || event.event || event.eventType || "unknown";
  const allowOther = eventType === "call.ended";
  const businessType = decideType(scores, { allowOther });

  // Calculate confidence as the difference between top and second score
  // When allowOther is false, exclude "other" from confidence calculation
  const scoresForConfidence = allowOther ? scores : { car: scores.car, restaurant: scores.restaurant };
  const sorted = Object.entries(scoresForConfidence).sort((a, b) => (b[1] as number) - (a[1] as number));
  const top = (sorted[0] as [string, number])[1];
  const second = (sorted[1] as [string, number])[1];
  const confidence = top - second;

  return {
    businessType,
    scores,
    detectedFrom: source,
    confidence,
  };
}
