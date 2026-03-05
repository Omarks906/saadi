import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTicket, TicketOrder } from "./render-ticket";

function assertLineLength(output: string) {
  const lines = output.split("\n");
  for (const line of lines) {
    assert.ok(
      line.length <= 48,
      `Line exceeds 48 chars (${line.length}): ${line}`
    );
  }
}

test("renderTicket renders pickup order", () => {
  const order: TicketOrder = {
    restaurantName: "Chilli Pizza",
    restaurantPhone: "+1 555-123-4567",
    orderNumber: "A1001",
    confirmedAt: "2026-01-23T12:30:00Z",
    fulfillment: "pickup",
    items: [
      {
        name: "Pepperoni Pizza",
        quantity: 2,
        modifiers: ["Extra cheese", { name: "Gluten-free crust" }],
        notes: "Cut into 8 slices",
      },
      {
        name: "Garlic Bread",
        quantity: 1,
      },
    ],
    notes: "Leave at counter if busy",
    customer: {
      name: "Sam Taylor",
      phone: "+1 555-222-3333",
    },
    totalAmount: 42.5,
    currency: "USD",
  };

  const output = renderTicket(order);
  assert.doesNotMatch(output, /Chilli Pizza/);
  assert.doesNotMatch(output, /\+1 555-123-4567/);
  assert.match(output, /ORDER #A1001/);
  assert.doesNotMatch(output, /CONFIRMED BY PHONE/);
  assert.match(output, /PICKUP/);
  assert.match(output, /2x Pepperoni Pizza/);
  assert.match(output, /- Extra cheese/);
  assert.match(output, /Gluten-free crust/);
  assert.match(output, /\* Cut into 8 slices/);
  assert.match(output, /Customer: Sam Taylor/);
  assert.match(output, /\+1 555-222-3333/);
  assert.doesNotMatch(output, /TOTAL: 42.50 USD/);
  assertLineLength(output);
});

test("renderTicket shortens UUID order numbers", () => {
  const order: TicketOrder = {
    orderNumber: "019cbe0b-d8ba-7222-97e9-8f9d844dab1",
    fulfillment: "pickup",
    items: [{ name: "Burger" }],
  };
  const output = renderTicket(order);
  // Should show shortened 8-char hex, not the full UUID
  assert.match(output, /ORDER #019CBE0B/);
  assert.doesNotMatch(output, /d8ba/);
  assertLineLength(output);
});

test("renderTicket renders delivery order with allergies", () => {
  const order: TicketOrder = {
    restaurantName: "Chilli Pizza",
    orderNumber: "B2002",
    confirmedAt: "2026-01-23T18:10:00Z",
    fulfillment: "delivery",
    items: [
      {
        name: "Veggie Pizza",
        quantity: 1,
        modifiers: ["No onions", "Extra olives"],
      },
    ],
    allergies: "Peanut allergy",
    customer: {
      name: "Alex Morgan",
      phone: "+1 555-999-0000",
      address: "123 Main Street, Unit 4B, Springfield",
    },
  };

  const output = renderTicket(order);
  assert.match(output, /ORDER #B2002/);
  assert.match(output, /DELIVERY/);
  assert.match(output, /Veggie Pizza/);
  assert.match(output, /!! ALLERGIES: Peanut allergy/);
  assert.doesNotMatch(output, /Address:/);
  assert.doesNotMatch(output, /Printed automatically via Phone Assistant/);
  assertLineLength(output);
});
