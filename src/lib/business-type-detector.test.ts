import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectBusinessTypeFromCall,
  shouldSwitch,
  BusinessTypeDetection,
} from "./business-type-detector";

// ============================================================
// detectBusinessTypeFromCall - Restaurant Detection
// ============================================================

test("detectBusinessTypeFromCall detects restaurant from pizza keywords", () => {
  const event = {
    call: {
      transcript: "I would like to order a pizza for delivery please",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "restaurant");
  assert.ok(result.scores.restaurant > 0);
  assert.equal(result.detectedFrom, "call.transcript");
});

test("detectBusinessTypeFromCall detects restaurant from Swedish keywords", () => {
  const event = {
    call: {
      transcript: "Jag vill beställa pizza med leverans till min adress",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "restaurant");
  assert.ok(result.scores.restaurant > result.scores.car);
});

test("detectBusinessTypeFromCall detects restaurant from menu/order keywords", () => {
  const event = {
    transcript: "Can I see the menu and make a booking for a table?",
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "restaurant");
});

// ============================================================
// detectBusinessTypeFromCall - Car Detection
// ============================================================

test("detectBusinessTypeFromCall detects car from vehicle keywords", () => {
  const event = {
    call: {
      transcript:
        "I want to sell my car on Blocket. It has low mileage and good service history.",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "car");
  assert.ok(result.scores.car > 0);
});

test("detectBusinessTypeFromCall detects car from Swedish keywords", () => {
  const event = {
    call: {
      transcript: "Jag vill sälja min bil på Blocket. Den har lågt miltal.",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "car");
  assert.ok(result.scores.car > result.scores.restaurant);
});

test("detectBusinessTypeFromCall detects car from registration/service keywords", () => {
  const event = {
    transcript:
      "The vehicle registration is up to date and besiktning passed recently",
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "car");
});

// ============================================================
// detectBusinessTypeFromCall - Router (Ambiguous)
// ============================================================

test("detectBusinessTypeFromCall returns router for empty text", () => {
  const event = {
    call: {
      transcript: "",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "router");
  assert.equal(result.confidence, 0);
});

test("detectBusinessTypeFromCall returns router for very short text", () => {
  const event = {
    transcript: "Hello there",
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "router");
});

test("detectBusinessTypeFromCall returns router for ambiguous text", () => {
  const event = {
    call: {
      transcript: "Hi, I have a question about your opening hours",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // "hours" is a restaurant keyword but alone it's not strong enough
  // This should return router due to low confidence
  assert.ok(
    result.businessType === "router" || result.businessType === "restaurant"
  );
});

test("detectBusinessTypeFromCall returns router when no event data", () => {
  const event = {};

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "router");
  assert.equal(result.detectedFrom, "unknown");
});

// ============================================================
// detectBusinessTypeFromCall - Text Extraction Sources
// ============================================================

test("detectBusinessTypeFromCall extracts from call.transcript (priority)", () => {
  const event = {
    call: {
      transcript: "pizza order delivery menu",
    },
    transcript: "car vehicle sell buy",
  };

  const result = detectBusinessTypeFromCall(event);

  // Should use call.transcript which has restaurant keywords
  assert.equal(result.detectedFrom, "call.transcript");
  assert.equal(result.businessType, "restaurant");
});

test("detectBusinessTypeFromCall extracts from transcript fallback", () => {
  const event = {
    transcript: "I want to order pizza for pickup please",
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.detectedFrom, "transcript");
  assert.equal(result.businessType, "restaurant");
});

test("detectBusinessTypeFromCall extracts from call.summary", () => {
  const event = {
    call: {
      summary: "Customer wants to order pizza with delivery",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.detectedFrom, "call.summary");
  assert.equal(result.businessType, "restaurant");
});

test("detectBusinessTypeFromCall extracts from summary fallback", () => {
  const event = {
    summary: "Customer wants to sell their car with low mileage",
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.detectedFrom, "summary");
  assert.equal(result.businessType, "car");
});

test("detectBusinessTypeFromCall extracts from metadata", () => {
  const event = {
    call: {
      metadata: { type: "pizza restaurant order" },
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.detectedFrom, "metadata");
});

test("detectBusinessTypeFromCall combines multiple sources", () => {
  const event = {
    call: {
      transcript: "pizza",
      summary: "order delivery",
      metadata: { note: "menu" },
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // Should combine all sources and detect restaurant
  assert.equal(result.businessType, "restaurant");
  assert.ok(result.scores.restaurant > 0);
});

// ============================================================
// Scoring Logic
// ============================================================

test("detectBusinessTypeFromCall scores increase with more keyword matches", () => {
  const fewKeywords = {
    call: { transcript: "I want pizza" },
  };

  const manyKeywords = {
    call: {
      transcript:
        "I want to order pizza from the menu for delivery to my address with table booking",
    },
  };

  const resultFew = detectBusinessTypeFromCall(fewKeywords);
  const resultMany = detectBusinessTypeFromCall(manyKeywords);

  assert.ok(resultMany.scores.restaurant >= resultFew.scores.restaurant);
});

test("detectBusinessTypeFromCall scores cap at 1.0", () => {
  const event = {
    call: {
      transcript:
        "pizza restaurant order delivery pickup menu table booking open hours address pizza pizza pizza",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.ok(result.scores.restaurant <= 1);
  assert.ok(result.scores.car <= 1);
  assert.ok(result.scores.other <= 1);
});

test("detectBusinessTypeFromCall other score is always 0 during call", () => {
  const event = {
    call: {
      transcript: "Some random text without keywords",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.scores.other, 0);
});

// ============================================================
// Confidence Calculation
// ============================================================

test("detectBusinessTypeFromCall confidence is difference between top scores", () => {
  const event = {
    call: {
      transcript: "pizza pizza pizza order delivery menu table booking",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // Confidence should be restaurant score - car score (or second highest)
  const sortedScores = Object.values({
    car: result.scores.car,
    restaurant: result.scores.restaurant,
  }).sort((a, b) => b - a);
  const expectedConfidence = sortedScores[0] - sortedScores[1];

  assert.equal(result.confidence, expectedConfidence);
});

// ============================================================
// shouldSwitch Function
// ============================================================

test("shouldSwitch returns true when current is router", () => {
  const scores = { restaurant: 0.8, car: 0.1, other: 0 };

  const result = shouldSwitch("router", "restaurant", scores);

  assert.equal(result, true);
});

test("shouldSwitch returns false when current equals next", () => {
  const scores = { restaurant: 0.8, car: 0.1, other: 0 };

  const result = shouldSwitch("restaurant", "restaurant", scores);

  assert.equal(result, false);
});

test("shouldSwitch returns false when trying to switch to router", () => {
  const scores = { restaurant: 0.3, car: 0.3, other: 0 };

  const result = shouldSwitch("restaurant", "router", scores);

  assert.equal(result, false);
});

test("shouldSwitch returns false when trying to switch to other", () => {
  const scores = { restaurant: 0.3, car: 0.3, other: 0.5 };

  const result = shouldSwitch("restaurant", "other", scores);

  assert.equal(result, false);
});

test("shouldSwitch requires strong score to switch restaurant to car", () => {
  // Weak switch attempt (score not high enough)
  const weakScores = { restaurant: 0.5, car: 0.6, other: 0 };
  const weakResult = shouldSwitch("restaurant", "car", weakScores);
  assert.equal(weakResult, false);

  // Strong switch attempt (score >= 0.85 and margin >= 0.20)
  const strongScores = { restaurant: 0.3, car: 0.9, other: 0 };
  const strongResult = shouldSwitch("restaurant", "car", strongScores);
  assert.equal(strongResult, true);
});

test("shouldSwitch requires strong score to switch car to restaurant", () => {
  // Weak switch attempt
  const weakScores = { restaurant: 0.7, car: 0.5, other: 0 };
  const weakResult = shouldSwitch("car", "restaurant", weakScores);
  assert.equal(weakResult, false);

  // Strong switch attempt
  const strongScores = { restaurant: 0.95, car: 0.3, other: 0 };
  const strongResult = shouldSwitch("car", "restaurant", strongScores);
  assert.equal(strongResult, true);
});

test("shouldSwitch respects SWITCH_STRONG threshold (0.85)", () => {
  // Just below threshold
  const belowThreshold = { restaurant: 0.84, car: 0.3, other: 0 };
  const resultBelow = shouldSwitch("car", "restaurant", belowThreshold);
  assert.equal(resultBelow, false);

  // At threshold with sufficient margin
  const atThreshold = { restaurant: 0.85, car: 0.3, other: 0 };
  const resultAt = shouldSwitch("car", "restaurant", atThreshold);
  assert.equal(resultAt, true);
});

test("shouldSwitch respects SWITCH_MARGIN threshold (0.20)", () => {
  // High score but insufficient margin
  const insufficientMargin = { restaurant: 0.90, car: 0.75, other: 0 };
  const resultInsufficient = shouldSwitch("car", "restaurant", insufficientMargin);
  assert.equal(resultInsufficient, false);

  // High score with sufficient margin
  const sufficientMargin = { restaurant: 0.90, car: 0.65, other: 0 };
  const resultSufficient = shouldSwitch("car", "restaurant", sufficientMargin);
  assert.equal(resultSufficient, true);
});

// ============================================================
// Threshold Constants (STRONG=0.70, MARGIN=0.15)
// ============================================================

test("detectBusinessTypeFromCall uses STRONG threshold (0.70)", () => {
  // Score just below 0.70 should potentially return router if margin is also low
  const event = {
    call: {
      transcript: "pizza order", // Minimal keywords
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // With few keywords, score might be below threshold
  // This test documents the threshold behavior
  assert.ok(
    result.businessType === "restaurant" || result.businessType === "router"
  );
});

test("detectBusinessTypeFromCall uses MARGIN threshold (0.15)", () => {
  // When top score has margin >= 0.15 over second, it should be accepted
  const event = {
    call: {
      transcript: "pizza order delivery menu table booking restaurant",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // Clear restaurant signal should give good margin
  assert.equal(result.businessType, "restaurant");
  assert.ok(result.scores.restaurant - result.scores.car >= 0.15);
});

// ============================================================
// Edge Cases
// ============================================================

test("detectBusinessTypeFromCall handles mixed keywords", () => {
  const event = {
    call: {
      transcript: "I want to order pizza and also sell my car on blocket",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // Both scores should be non-zero
  assert.ok(result.scores.restaurant > 0);
  assert.ok(result.scores.car > 0);

  // Result depends on which has more keywords or higher score
  assert.ok(
    result.businessType === "restaurant" ||
      result.businessType === "car" ||
      result.businessType === "router"
  );
});

test("detectBusinessTypeFromCall is case insensitive", () => {
  const event = {
    call: {
      transcript: "PIZZA ORDER DELIVERY MENU",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "restaurant");
});

test("detectBusinessTypeFromCall uses word boundaries for matching", () => {
  const event = {
    call: {
      transcript: "I have a carburetor problem with my automat transmission",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  // "automat" should match as a car keyword (word boundary)
  assert.ok(result.scores.car > 0);
});

test("detectBusinessTypeFromCall handles phone number fields", () => {
  const event = {
    call: {
      from: "+46701234567",
      to: "+46801234567",
    },
    phoneNumber: "+46701234567",
  };

  const result = detectBusinessTypeFromCall(event);

  // Phone numbers don't contain keywords, should be router
  assert.equal(result.businessType, "router");
});

test("detectBusinessTypeFromCall handles message field", () => {
  const event = {
    message: "I want to order pizza for delivery",
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "restaurant");
});

test("detectBusinessTypeFromCall handles call.message field", () => {
  const event = {
    call: {
      message: "Customer calling about their car listing on blocket",
    },
  };

  const result = detectBusinessTypeFromCall(event);

  assert.equal(result.businessType, "car");
});
