/**
 * Test harness for the print pipeline.
 *
 * Loads a synthetic AI-extracted order and runs runPrintPipeline in
 * PRINT_TEST_MODE=1 so no hardware is needed. The rendered ticket is logged
 * to stdout and the job is immediately marked "sent".
 *
 * Usage:
 *   PRINT_TEST_MODE=1 DATABASE_URL=postgres://... \
 *     npx ts-node -r dotenv/config --project tsconfig.json scripts/testPrint.ts
 *
 * To exercise the review-warning banner (confidence < 85):
 *   PRINT_TEST_MODE=1 FORCE_LOW_CONFIDENCE=1 DATABASE_URL=... \
 *     npx ts-node -r dotenv/config --project tsconfig.json scripts/testPrint.ts
 */

import crypto from "crypto";
import { runPrintPipeline } from "../src/lib/printing/print-pipeline";
import type { Order } from "../src/lib/vapi-storage";

process.env.PRINT_TEST_MODE = "1";
process.env.PRINT_PROVIDER = process.env.PRINT_PROVIDER || "mock";

const lowConfidence = process.env.FORCE_LOW_CONFIDENCE === "1";

const SAMPLE_ORDERS: Array<{ label: string; order: Order }> = [
  {
    label: "High-confidence pickup — no warning banner",
    order: {
      id: crypto.randomUUID(),
      orderId: `test-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: "chilli",
      organizationId: process.env.TEST_ORG_ID || "chilli-org",
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      status: "pending_review",
      fulfillmentType: "pickup",
      customerName: "Anna Svensson",
      customerPhone: "+46701234567",
      items: [
        { name: "Capricciosa", quantity: 1, description: "halva kebab, halva giro" },
        { name: "Läsk", quantity: 2 },
      ],
      overallConfidence: 92,
      extractionModel: "gpt-5.2",
      extractionVersion: 1,
      extractedJson: { needs_review: false, overall_confidence: 92 },
      postProcessed: true,
    },
  },
  {
    label: lowConfidence
      ? "Low-confidence order (forced) — OSÄKERT banner shown"
      : "Low-confidence order (confidence 60) — OSÄKERT banner shown",
    order: {
      id: crypto.randomUUID(),
      orderId: `test-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: "chilli",
      organizationId: process.env.TEST_ORG_ID || "chilli-org",
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      status: "pending_review",
      fulfillmentType: "delivery",
      customerName: "Erik Johansson",
      customerPhone: "+46709876543",
      customerAddress: "Storgatan 12, Stockholm",
      items: [
        { name: "Kebabpizza", quantity: 1 },
        { name: "Vitlökssås", quantity: 1 },
      ],
      overallConfidence: lowConfidence ? 50 : 60,
      extractionModel: "gpt-5.2",
      extractionVersion: 1,
      extractedJson: { needs_review: false, overall_confidence: lowConfidence ? 50 : 60 },
      postProcessed: true,
    },
  },
  {
    label: "needs_review=true — OSÄKERT banner shown regardless of confidence",
    order: {
      id: crypto.randomUUID(),
      orderId: `test-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: "chilli",
      organizationId: process.env.TEST_ORG_ID || "chilli-org",
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      status: "pending_review",
      fulfillmentType: "pickup",
      customerName: "Maria Nilsson",
      items: [{ name: "Quattro Stagioni", quantity: 1, description: "extra ost" }],
      overallConfidence: 88,
      extractionModel: "gpt-5.2",
      extractionVersion: 1,
      extractedJson: { needs_review: true, overall_confidence: 88 },
      postProcessed: true,
    },
  },
];

async function main() {
  for (const { label, order } of SAMPLE_ORDERS) {
    console.log("\n" + "=".repeat(60));
    console.log(`[${label}]`);
    console.log(
      `  orderId=${order.orderId}  confidence=${order.overallConfidence}  needs_review=${order.extractedJson?.needs_review}`
    );
    console.log("-".repeat(60));

    try {
      const result = await runPrintPipeline(order, {
        organizationId: order.organizationId,
      });
      console.log("Pipeline result:", result);
    } catch (err: any) {
      console.error("Pipeline error:", err?.message || err);
    }
  }
}

main().catch(console.error);
