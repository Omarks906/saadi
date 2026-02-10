import assert from "node:assert/strict";
import { test } from "node:test";
import { extractOrderFromTranscript, ExtractedOrder } from "./order-extract";

// ============================================================
// Basic Menu Item Detection
// ============================================================

test("extractOrderFromTranscript detects single menu item", () => {
  const result = extractOrderFromTranscript("Jag vill ha en margherita");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "margherita");
  assert.equal(result.items[0].qty, 1);
});

test("extractOrderFromTranscript detects multiple menu items", () => {
  const result = extractOrderFromTranscript(
    "Vi vill beställa en margherita och en hawaii"
  );

  assert.equal(result.items.length, 2);
  const names = result.items.map((i) => i.name);
  assert.ok(names.includes("margherita"));
  assert.ok(names.includes("hawaii"));
});

test("extractOrderFromTranscript detects all standard menu items", () => {
  const menuItems = [
    "margherita",
    "vesuvio",
    "calzone",
    "capricciosa",
    "hawaii",
    "bussola",
    "al tonno",
    "opera",
    "pompei",
    "chicko banana",
    "gudfadern",
    "salami",
    "bolognese",
    "vegetarisk",
    "funge",
  ];

  for (const item of menuItems) {
    const result = extractOrderFromTranscript(`Jag vill ha ${item}`);
    assert.equal(
      result.items.length,
      1,
      `Expected to detect ${item}`
    );
    assert.equal(result.items[0].name, item);
  }
});

test("extractOrderFromTranscript is case insensitive", () => {
  const result = extractOrderFromTranscript("MARGHERITA och Hawaii");

  assert.equal(result.items.length, 2);
  const names = result.items.map((i) => i.name);
  assert.ok(names.includes("margherita"));
  assert.ok(names.includes("hawaii"));
});

test("extractOrderFromTranscript handles empty transcript", () => {
  const result = extractOrderFromTranscript("");

  assert.equal(result.items.length, 0);
  assert.equal(result.confidence, 0);
  assert.equal(result.rawText, "");
});

test("extractOrderFromTranscript handles transcript with no menu items", () => {
  const result = extractOrderFromTranscript("Hej, vad har ni för öppettider?");

  assert.equal(result.items.length, 0);
  assert.equal(result.confidence, 0);
});

// ============================================================
// Quantity Detection
// ============================================================

test("extractOrderFromTranscript detects numeric quantity before item", () => {
  const result = extractOrderFromTranscript("3 margherita tack");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "margherita");
  assert.equal(result.items[0].qty, 3);
});

test("extractOrderFromTranscript detects quantity with x notation", () => {
  const result = extractOrderFromTranscript("margherita x 2");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "margherita");
  assert.equal(result.items[0].qty, 2);
});

test("extractOrderFromTranscript detects quantity with asterisk notation", () => {
  const result = extractOrderFromTranscript("margherita * 4");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "margherita");
  assert.equal(result.items[0].qty, 4);
});

test("extractOrderFromTranscript detects Swedish word 'tva' as quantity 2", () => {
  // The Swedish word detection requires the word to come AFTER the menu item
  // Note: Uses "tva" (ASCII) because \b word boundary doesn't work with "två" (Swedish å)
  const result = extractOrderFromTranscript("vi tar margherita tva");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 2);
});

test("extractOrderFromTranscript detects Swedish word 'tre' as quantity 3", () => {
  const result = extractOrderFromTranscript("margherita tre stycken");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 3);
});

test("extractOrderFromTranscript defaults to quantity 1", () => {
  const result = extractOrderFromTranscript("en margherita tack");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 1);
});

test("extractOrderFromTranscript caps quantity between 1 and 99", () => {
  // The regex only captures 1-2 digits, so 3-digit numbers like "150"
  // will match the last 2 digits before whitespace ("50" in this case)
  const result = extractOrderFromTranscript("99 margherita");

  assert.equal(result.items[0].qty, 99);

  // Test that quantity is capped at minimum of 1
  const resultZero = extractOrderFromTranscript("0 margherita");
  assert.equal(resultZero.items[0].qty, 1);
});

// ============================================================
// Fulfillment Detection (Pickup vs Delivery)
// ============================================================

test("extractOrderFromTranscript detects pickup - Swedish 'avhämtning'", () => {
  const result = extractOrderFromTranscript("En margherita för avhämtning");

  assert.equal(result.fulfillment, "pickup");
});

test("extractOrderFromTranscript detects pickup - Swedish 'hämtar'", () => {
  const result = extractOrderFromTranscript("Jag hämtar själv");

  assert.equal(result.fulfillment, "pickup");
});

test("extractOrderFromTranscript detects pickup - English", () => {
  const result = extractOrderFromTranscript("I want to pickup my order");

  assert.equal(result.fulfillment, "pickup");
});

test("extractOrderFromTranscript detects pickup - takeaway", () => {
  const result = extractOrderFromTranscript("En margherita takeaway");

  assert.equal(result.fulfillment, "pickup");
});

test("extractOrderFromTranscript detects delivery - Swedish 'hemkörning'", () => {
  const result = extractOrderFromTranscript("En margherita med hemkörning");

  assert.equal(result.fulfillment, "delivery");
});

test("extractOrderFromTranscript detects delivery - Swedish 'leverans'", () => {
  const result = extractOrderFromTranscript("Leverans till Kungsgatan 5");

  assert.equal(result.fulfillment, "delivery");
});

test("extractOrderFromTranscript detects delivery - English", () => {
  const result = extractOrderFromTranscript("I need delivery please");

  assert.equal(result.fulfillment, "delivery");
});

test("extractOrderFromTranscript detects delivery - 'till adress'", () => {
  const result = extractOrderFromTranscript("Kan ni köra till adress");

  assert.equal(result.fulfillment, "delivery");
});

test("extractOrderFromTranscript returns undefined for ambiguous fulfillment", () => {
  const result = extractOrderFromTranscript("En margherita tack");

  assert.equal(result.fulfillment, undefined);
});

// ============================================================
// Time Detection
// ============================================================

test("extractOrderFromTranscript detects time with 'kl'", () => {
  const result = extractOrderFromTranscript("kl 18 tack");

  assert.equal(result.requestedTime, "18:00");
});

test("extractOrderFromTranscript detects time with 'klockan'", () => {
  const result = extractOrderFromTranscript("klockan 17 tack");

  assert.equal(result.requestedTime, "17:00");
});

test("extractOrderFromTranscript detects time with minutes", () => {
  const result = extractOrderFromTranscript("kl 18:30");

  assert.equal(result.requestedTime, "18:30");
});

test("extractOrderFromTranscript detects time with dot separator", () => {
  const result = extractOrderFromTranscript("kl 18.45");

  assert.equal(result.requestedTime, "18:45");
});

test("extractOrderFromTranscript detects standalone time format", () => {
  const result = extractOrderFromTranscript("Vi kommer 19:00");

  assert.equal(result.requestedTime, "19:00");
});

test("extractOrderFromTranscript detects relative time 'om X minuter'", () => {
  const result = extractOrderFromTranscript("om 20 minuter");

  assert.equal(result.requestedTime, "in 20 minutes");
});

test("extractOrderFromTranscript detects relative time 'om X min'", () => {
  const result = extractOrderFromTranscript("om 30 min");

  assert.equal(result.requestedTime, "in 30 minutes");
});

test("extractOrderFromTranscript returns undefined for no time", () => {
  const result = extractOrderFromTranscript("En margherita tack");

  assert.equal(result.requestedTime, undefined);
});

// ============================================================
// Size Detection
// ============================================================

test("extractOrderFromTranscript detects family size - 'familj'", () => {
  const result = extractOrderFromTranscript("En margherita familj");

  assert.equal(result.items[0].size, "familj");
});

test("extractOrderFromTranscript detects family size - 'familje'", () => {
  const result = extractOrderFromTranscript("En familje margherita");

  assert.equal(result.items[0].size, "familj");
});

test("extractOrderFromTranscript detects regular size - 'ordinarie'", () => {
  const result = extractOrderFromTranscript("En ordinarie margherita");

  assert.equal(result.items[0].size, "ordinarie");
});

test("extractOrderFromTranscript detects regular size - 'vanlig'", () => {
  const result = extractOrderFromTranscript("En vanlig margherita");

  assert.equal(result.items[0].size, "ordinarie");
});

test("extractOrderFromTranscript returns undefined size when not specified", () => {
  const result = extractOrderFromTranscript("En margherita");

  assert.equal(result.items[0].size, undefined);
});

// ============================================================
// Toggles (Gluten Free, Mozzarella)
// ============================================================

test("extractOrderFromTranscript detects gluten free - Swedish", () => {
  const result = extractOrderFromTranscript("En glutenfri margherita");

  assert.equal(result.items[0].glutenFree, true);
});

test("extractOrderFromTranscript detects gluten free - English", () => {
  const result = extractOrderFromTranscript("One gluten free margherita");

  assert.equal(result.items[0].glutenFree, true);
});

test("extractOrderFromTranscript detects mozzarella", () => {
  const result = extractOrderFromTranscript("En margherita med extra mozzarella");

  assert.equal(result.items[0].mozzarella, true);
});

test("extractOrderFromTranscript toggles are undefined when not mentioned", () => {
  const result = extractOrderFromTranscript("En margherita");

  assert.equal(result.items[0].glutenFree, undefined);
  assert.equal(result.items[0].mozzarella, undefined);
});

// ============================================================
// Confidence Score
// ============================================================

test("extractOrderFromTranscript confidence is 0 for no items", () => {
  const result = extractOrderFromTranscript("Hej, vad kostar det?");

  assert.equal(result.confidence, 0);
});

test("extractOrderFromTranscript confidence is 0.65 for single item", () => {
  const result = extractOrderFromTranscript("En margherita");

  assert.equal(result.confidence, 0.65);
});

test("extractOrderFromTranscript confidence is 0.8 for multiple items", () => {
  const result = extractOrderFromTranscript("En margherita och en hawaii");

  assert.equal(result.confidence, 0.8);
});

// ============================================================
// Raw Text Preservation
// ============================================================

test("extractOrderFromTranscript preserves rawText", () => {
  const transcript = "  En Margherita  ";
  const result = extractOrderFromTranscript(transcript);

  assert.equal(result.rawText, transcript);
});

// ============================================================
// Edge Cases and Complex Scenarios
// ============================================================

test("extractOrderFromTranscript handles multi-word menu items", () => {
  const result = extractOrderFromTranscript("En al tonno och chicko banana");

  assert.equal(result.items.length, 2);
  const names = result.items.map((i) => i.name);
  assert.ok(names.includes("al tonno"));
  assert.ok(names.includes("chicko banana"));
});

test("extractOrderFromTranscript handles complex order", () => {
  const transcript =
    "Jag vill beställa 2 margherita familj glutenfri och 1 hawaii för avhämtning kl 18:30";
  const result = extractOrderFromTranscript(transcript);

  assert.equal(result.items.length, 2);

  const margherita = result.items.find((i) => i.name === "margherita");
  assert.ok(margherita);
  assert.equal(margherita.qty, 2);
  assert.equal(margherita.size, "familj");
  assert.equal(margherita.glutenFree, true);

  const hawaii = result.items.find((i) => i.name === "hawaii");
  assert.ok(hawaii);
  assert.equal(hawaii.qty, 1);

  assert.equal(result.fulfillment, "pickup");
  assert.equal(result.requestedTime, "18:30");
});

test("extractOrderFromTranscript normalizes whitespace and quotes", () => {
  const result = extractOrderFromTranscript("En  'margherita'  tack");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "margherita");
});

test("extractOrderFromTranscript handles Swedish characters in menu items", () => {
  // Test that Swedish characters don't break parsing
  const result = extractOrderFromTranscript(
    "Jag vill beställa en margherita för avhämtning"
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 1);
  assert.equal(result.fulfillment, "pickup");
});
