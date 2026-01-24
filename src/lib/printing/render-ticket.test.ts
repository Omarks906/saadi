import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTicket, TicketOrder } from "./render-ticket";

function assertLineLength(output: string) {
  const lines = output.split("\n");
  for (const line of lines) {
    assert.ok(
      line.length <= 42,
      `Line exceeds 42 chars (${line.length}): ${line}`
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
  assert.match(output, /Chilli Pizza/);
  assert.match(output, /\+1 555-123-4567/);
  assert.match(output, /ORDER #A1001/);
  assert.match(output, /CONFIRMED BY PHONE/);
  assert.match(output, /PICKUP/);
  assert.match(output, /2x Pepperoni Pizza/);
  assert.match(output, /- Extra cheese/);
  assert.match(output, /Gluten-free crust/);
  assert.match(output, /Notes: Cut into 8 slices/);
  assert.match(output, /Customer: Sam Taylor/);
  assert.match(output, /Phone: \+1 555-222-3333/);
  assert.match(output, /TOTAL: 42.50 USD/);
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
  assert.match(output, /Allergies: Peanut allergy/);
  assert.match(output, /Address: 123 Main Street, Unit 4B, Springfield/);
  assert.match(output, /Printed automatically via Phone Assistant/);
  assertLineLength(output);
});
