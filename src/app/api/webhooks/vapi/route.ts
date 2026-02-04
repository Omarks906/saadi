import { NextRequest, NextResponse } from "next/server";
import {
  createCall,
  findCallByCallIdByOrganization,
  updateCall,
  extractAssistantId,
} from "@/lib/vapi-storage";
import {
  createOrder,
  findOrderByOrderIdByOrganization,
  updateOrder,
  type FulfillmentType,
} from "@/lib/vapi-storage";
import { getBusinessTypeFromAssistantId } from "@/lib/vapi-assistant-map";
import { detectBusinessTypeFromCall, shouldSwitch } from "@/lib/business-type-detector";
import { runPrintPipeline } from "@/lib/printing/print-pipeline";
import { resolveOrgContextForWebhook } from "@/lib/org-context";
import { extractOrderFromTranscript } from "@/lib/order-extract";
import { getPool, initDatabase } from "@/lib/db/connection";

export const runtime = "nodejs";

/**
 * In-memory store for seen events to prevent duplicate processing
 * Keyed by: event.id or ${event.type}:${callId}:${timestamp}
 */
const seenEvents = new Set<string>();
let didDebugOrderPayload = false;

function extractOrderId(payload: any): string | null {
  return (
    payload?.order?.id ||
    payload?.id ||
    payload?.orderId ||
    payload?.data?.orderId ||
    payload?.data?.order?.id ||
    payload?.message?.orderId ||
    payload?.message?.order?.id ||
    payload?.data?.id ||
    payload?.message?.id ||
    null
  );
}

function redactPayload(value: any, keyHint?: string): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => redactPayload(entry, keyHint));
  }
  if (typeof value === "object") {
    const output: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("phone") || lowerKey.includes("address") || lowerKey.includes("email")) {
        output[key] = "***";
        continue;
      }
      output[key] = redactPayload(entry, key);
    }
    return output;
  }
  if (typeof value === "string") {
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    if ((keyHint || "").toLowerCase().includes("email") || emailRegex.test(value)) {
      return "***";
    }
  }
  return value;
}

const STRUCTURED_OUTPUT_ID =
  process.env.VAPI_CHILLI_ORDER_STRUCTURED_OUTPUT_ID ||
  "e8cfb9c2-1892-4b7f-a1f3-a4e97fc9d73e";

/**
 * Generate a stable key for an event to check idempotency
 */
function getEventKey(event: any, callId?: string): string {
  // Use event.id if present (most reliable)
  if (event.id) {
    return event.id;
  }
  
  // Fallback to composite key
  const eventType = event.type || event.event || event.eventType || "unknown";
  const timestamp = event.timestamp || event.createdAt || event.startedAt || Date.now().toString();
  const id = callId || event.call?.id || event.order?.id || "unknown";
  
  return `${eventType}:${id}:${timestamp}`;
}

/**
 * Check if an event has already been processed
 */
function isEventSeen(eventKey: string): boolean {
  return seenEvents.has(eventKey);
}

/**
 * Mark an event as seen
 */
function markEventSeen(eventKey: string): void {
  // Limit the size to prevent memory issues (keep last 10000 events)
  if (seenEvents.size > 10000) {
    const firstKey = seenEvents.values().next().value;
    if (firstKey !== undefined) {
      seenEvents.delete(firstKey);
    }
  }
  seenEvents.add(eventKey);
}

/**
 * VAPI Webhook Handler
 * Handles events from VAPI (Voice AI Platform)
 * 
 * Supported events:
 * - call.started: When a call begins
 * - order.confirmed: When an order is confirmed
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(
      "[VAPI Webhook] Body received (keys):",
      Object.keys(body || {}),
      "messageKeys:",
      Object.keys(body?.message || {}),
      "callKeys:",
      Object.keys(body?.call || {}),
      "statusUpdateKeys:",
      Object.keys(body?.statusUpdate || {}),
      "endOfCallReportKeys:",
      Object.keys(body?.endOfCallReport || {})
    );
    const org = await resolveOrgContextForWebhook(req, body);
    const resolvedAssistantId = extractAssistantId(body);
    if (resolvedAssistantId) {
      console.log("[VAPI Webhook] Resolved assistantId:", resolvedAssistantId);
    }
    // VAPI sends events in different formats:
    // - body.type (standard)
    // - body.event (alternative)
    // - body.eventType (alternative)
    // - body.message.type (VAPI message format)
    const eventType = body.type || body.event || body.eventType || body.message?.type;

    // Check idempotency - get callId/orderId for key generation
    // VAPI sends call ID in various locations depending on event type
    const callId = body.call?.id || 
                   body.id || 
                   body.callId || 
                   body.callId || 
                   body.message?.call?.id ||
                   body.message?.callId ||
                   body.statusUpdate?.call?.id ||
                   body.endOfCallReport?.call?.id;
    const orderId = extractOrderId(body);
    const eventKey = getEventKey(body, (callId || orderId) || undefined);

    // Skip if event already processed
    if (isEventSeen(eventKey)) {
      console.log(`[VAPI Webhook] Duplicate event detected, skipping: ${eventKey}`);
      return NextResponse.json({
        success: true,
        message: "Event already processed",
        eventKey,
      });
    }

    // Reduced logging to avoid Railway rate limits
    // For status-update and end-of-call-report, log more details to debug call ID location
    if (eventType === "status-update" || eventType === "end-of-call-report") {
      console.log("[VAPI Webhook] Received event:", eventType, {
        timestamp: new Date().toISOString(),
        callIdLocations: {
          bodyId: body.id,
          bodyCallId: body.call?.id,
          messageCallId: body.message?.call?.id,
          statusUpdateCallId: body.statusUpdate?.call?.id,
          endOfCallReportCallId: body.endOfCallReport?.call?.id,
        },
        extractedCallId: callId,
      });
    } else {
      console.log("[VAPI Webhook] Received event:", eventType || "unknown", {
        timestamp: new Date().toISOString(),
        eventKey,
        messageType: body.message?.type,
        callId: callId || "undefined",
      });
    }

    // Mark event as seen before processing
    markEventSeen(eventKey);

    // Handle status-update events (VAPI sends these for call state changes)
    if (eventType === "status-update" || body.message?.type === "status-update") {
      const statusUpdate = body.statusUpdate || body.message?.statusUpdate || body;
      const status = statusUpdate.status || body.status || body.message?.status;
      // Extract call ID from message.call.id (VAPI format)
      const callId = body.message?.call?.id || statusUpdate.call?.id || body.call?.id || body.id;
      
      if (callId) {
        if (status === "started" || status === "ringing" || status === "answered" || status === "in-progress") {
          return handleCallStarted(
            {
            ...body,
            call: { 
              ...body.call, 
              ...statusUpdate.call, 
              ...body.message?.call,
              id: callId 
            },
            type: "call.started",
            },
            org.id
          );
        }
        
        if (status === "ended" || status === "ended-by-user" || status === "ended-by-system" || status === "completed") {
          return handleCallEnded(
            {
            ...body,
            call: { 
              ...body.call, 
              ...statusUpdate.call,
              ...body.message?.call,
              id: callId 
            },
            type: "call.ended",
            },
            org.id
          );
        }
      }
    }

    // Handle end-of-call-report (VAPI sends this at the end of calls)
    if (eventType === "end-of-call-report" || body.message?.type === "end-of-call-report") {
      const report = body.endOfCallReport || body.message?.endOfCallReport || body;
      // Extract call ID from message.call.id (VAPI format)
      const callId = body.message?.call?.id || report.call?.id || report.id || body.id;
      
      if (callId) {
        const structuredOrder = extractStructuredOrderFromReport(body, report);
        if (structuredOrder) {
          await upsertOrderFromStructuredOutput({
            body,
            report,
            callId,
            organizationId: org.id,
            structuredOrder,
          });
        }
        // Check if call exists, if not create it first
        let existingCall = await findCallByCallIdByOrganization(callId, org.id);
        
        if (!existingCall) {
          // Create call first with available data
          const newCall = await createCall({
            call: { 
              id: callId,
              ...body.message?.call,
              ...report.call 
            },
            type: "call.started",
            startedAt: report.startedAt || report.startTime || report.createdAt || new Date().toISOString(),
          }, { organizationId: org.id });
          existingCall = newCall;
        }
        
        // Now update it with end-of-call report data
        const response = await handleCallEnded(
          {
          ...body,
          call: { 
            ...existingCall,
            ...report.call,
            ...body.message?.call,
            id: callId 
          },
          type: "call.ended",
          endedAt: report.endedAt || report.endTime || new Date().toISOString(),
          startedAt: report.startedAt || report.startTime || existingCall.startedAt,
          },
          org.id
        );
        void handleEndOfCall(
          {
            ...body,
            extractedCallId: callId,
            analysis:
              report.analysis ||
              body.analysis ||
              body.message?.analysis ||
              body.data?.analysis ||
              null,
            message: body.message || report.message || null,
            call: body.message?.call || report.call || body.call || null,
            customer: body.message?.customer || report.customer || body.customer || null,
            transcript: report.transcript || body.message?.transcript || body.transcript || null,
          },
          org
        );
        return response;
      }
    }

    // Handle call.started event (multiple possible formats)
    if (
      eventType === "call.started" || 
      eventType === "call-start" ||
      body.event === "call.started" ||
      body.message?.type === "call.started" ||
      (body.status === "started" && body.call)
    ) {
      return handleCallStarted(body, org.id);
    }

    // Handle call.ended event (multiple possible formats)
    if (
      eventType === "call.ended" || 
      eventType === "call-end" ||
      body.event === "call.ended" ||
      body.message?.type === "call.ended" ||
      (body.status === "ended" && body.call)
    ) {
      return handleCallEnded(body, org.id);
    }

    // Handle order.confirmed event (multiple possible formats)
    if (
      eventType === "order.confirmed" || 
      eventType === "order-confirmed" ||
      body.event === "order.confirmed" ||
      body.message?.type === "order.confirmed"
    ) {
      const orderId = extractOrderId(body);
      console.log("[VAPI webhook] order.confirmed", {
        hasOrderId: !!orderId,
        keys: Object.keys(body || {}),
        dataKeys: Object.keys(body?.data || {}),
        messageKeys: Object.keys(body?.message || {}),
      });
      return handleOrderConfirmed(body, org);
    }

    // VAPI sends many message types (transcript, function-call, etc.)
    // Only log unknown types that might be call events, and return success for others
    if (eventType && (eventType.includes("status") || eventType.includes("call"))) {
      console.warn("[VAPI Webhook] Unhandled call-related event:", eventType, "messageType:", body.message?.type);
    }
    
    // Return success for non-call events (transcripts, messages, function-calls, etc.)
    // VAPI sends many events we don't need to process
    return NextResponse.json({
      success: true,
      message: "Event received but not processed",
      eventType: eventType || "unknown",
      note: "This event type is not handled by the webhook"
    });
  } catch (error: any) {
    console.error("[VAPI Webhook] Error processing webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error",
        details: error?.stack,
      },
      { status: 200 }
    );
  }
}

type StructuredOrderResult = {
  outputId: string;
  data: Record<string, any>;
  analysis: Record<string, any>;
};

let didDebugStructuredOrderOnce = false;

function describeField(value: any): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

function extractStructuredOrderFromReport(body: any, report: any): StructuredOrderResult | null {
  const message = body?.message || {};
  const analysis = message.analysis || report?.analysis || {};
  const artifact = message.artifact || report?.artifact || {};
  const structuredOutputs =
    artifact.structuredOutputs || analysis.structuredOutputs || {};
  const raw = structuredOutputs[STRUCTURED_OUTPUT_ID];
  const data = raw?.result ?? raw;

  if (!data) {
    console.error("[order] No structured order found in structuredOutputs.");
    console.log("[debug] hasStructuredData:", analysis.hasStructuredData);
    console.log("[debug] Available keys:", Object.keys(structuredOutputs));
    return null;
  }

  if (!didDebugStructuredOrderOnce && process.env.DEBUG_STRUCTURED_ORDER_ONCE === "1") {
    didDebugStructuredOrderOnce = true;
    console.log(
      JSON.stringify({
        tag: "DEBUG_STRUCTURED_ORDER_ONCE",
        dataKeys: Object.keys(data || {}),
        addressFields: {
          address: describeField(data?.address),
          deliveryAddress: describeField(data?.deliveryAddress),
          customerAddress: describeField(data?.customerAddress),
          customer_address: describeField(data?.customer_address),
          delivery_address: describeField(data?.delivery_address),
          addressText: describeField(data?.addressText),
          customer_address_obj: describeField(data?.customer?.address),
          delivery_address_obj: describeField(data?.delivery?.address),
        },
      })
    );
  }

  return { outputId: STRUCTURED_OUTPUT_ID, data, analysis };
}

function normalizeOrderItems(items: unknown) {
  if (!items) return undefined;
  if (Array.isArray(items)) return items;
  if (typeof items !== "string") return undefined;

  const raw = items.trim();
  if (!raw) return undefined;

  const wordQtyTokens = new Set([
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ]);
  const hasQtyIndicator = (part: string) => {
    const trimmed = part.trim();
    if (
      /^(\d+)\s*x\s*/i.test(trimmed) ||
      /^.+?\s*x\s*\d+$/i.test(trimmed) ||
      /^.+?\s*\(x\s*\d+\)$/i.test(trimmed) ||
      /^(\d+)\s*(?:x\s*)?/.test(trimmed) ||
      /^.+?\s*(?:x\s*)?\d+$/i.test(trimmed) ||
      /^(\d+)\s+\w+\s+of\s+/i.test(trimmed)
    ) {
      return true;
    }
    const wordQtyMatch = trimmed.match(/^([a-z]+)\s+.+/i);
    return Boolean(wordQtyMatch && wordQtyTokens.has(wordQtyMatch[1].toLowerCase()));
  };

  const splitIntoCandidates = (text: string) => {
    const lines = text
      .split(/;|\n/gi)
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) => part.split(/\s+and\s+/gi).map((p) => p.trim()).filter(Boolean));

    const candidates: Array<{ itemText: string; description?: string }> = [];
    for (const line of lines) {
      const commaParts = line
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      if (commaParts.length <= 1) {
        candidates.push({ itemText: line });
        continue;
      }

      const itemLikeCount = commaParts.filter(hasQtyIndicator).length;
      if (itemLikeCount >= 2) {
        commaParts.forEach((itemText) => candidates.push({ itemText }));
        continue;
      }

      const [itemText, ...rest] = commaParts;
      candidates.push({
        itemText,
        description: rest.join(", "),
      });
    }

    return candidates;
  };

  const normalizeItemName = (name: string) =>
    name.replace(/^(st\.?|styck)\s+/i, "").trim();

  const parts = splitIntoCandidates(raw);

  if (!parts.length) return undefined;

  const wordQty: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  return parts.map(({ itemText, description }) => {
    const leadingX = itemText.match(/^(\d+)\s*x\s*(.+)$/i);
    if (leadingX) {
      const name = normalizeItemName(leadingX[2].trim());
      return { name, quantity: Number(leadingX[1]), description };
    }

    const trailingX = itemText.match(/^(.+?)\s*x\s*(\d+)$/i);
    if (trailingX) {
      const name = normalizeItemName(trailingX[1].trim());
      return { name, quantity: Number(trailingX[2]), description };
    }

    const parenQty = itemText.match(/^(.+?)\s*\(x\s*(\d+)\)$/i);
    if (parenQty) {
      const name = normalizeItemName(parenQty[1].trim());
      return { name, quantity: Number(parenQty[2]), description };
    }

    const leadingQty = itemText.match(/^(\d+)\s*(?:x\s*)?(.+)$/i);
    if (leadingQty) {
      const qty = Number(leadingQty[1]);
      const name = normalizeItemName(leadingQty[2].trim());
      if (qty > 0 && name) {
        return { name, quantity: qty, description };
      }
    }

    const trailingQty = itemText.match(/^(.+?)\s*(?:x\s*)?(\d+)$/i);
    if (trailingQty) {
      const qty = Number(trailingQty[2]);
      const name = normalizeItemName(trailingQty[1].trim());
      if (qty > 0 && name) {
        return { name, quantity: qty, description };
      }
    }

    const ofPhrase = itemText.match(/^(\d+)\s+\w+\s+of\s+(.+)$/i);
    if (ofPhrase) {
      const qty = Number(ofPhrase[1]);
      const name = normalizeItemName(ofPhrase[2].trim());
      if (qty > 0 && name) {
        return { name, quantity: qty, description };
      }
    }

    const wordQtyMatch = itemText.match(/^([a-z]+)\s+(.+)$/i);
    if (wordQtyMatch) {
      const qty = wordQty[wordQtyMatch[1].toLowerCase()];
      const name = normalizeItemName(wordQtyMatch[2].trim());
      if (qty && name) {
        return { name, quantity: qty, description };
      }
    }

    const sizePrefix = itemText.match(/^(small|medium|large|ordinary|family)\s+(.+)$/i);
    if (sizePrefix) {
      const size = sizePrefix[1].toLowerCase();
      const name = normalizeItemName(sizePrefix[2].trim());
      if (name) {
        return { name: `${size} ${name}`, quantity: 1, description };
      }
    }

    return { name: normalizeItemName(itemText), quantity: 1, description };
  });
}

function formatStructuredAddress(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "object") {
    const parts = [
      value.line1,
      value.line2,
      value.street,
      value.city,
      value.state,
      value.postalCode,
      value.postcode,
      value.country,
    ].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return undefined;
}

function extractAddressFromTranscript(transcript?: string | null): string | undefined {
  if (!transcript) return undefined;
  const candidates = transcript
    .split(/\n|[.!?]/)
    .map((line) => line.trim())
    .filter(Boolean);
  const skipHints = ["repeat", "please", "can you", "could you", "need a clearer", "what street"];
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (lower.includes("address") || lower.includes("adress")) {
      if (skipHints.some((hint) => lower.includes(hint))) continue;
      return candidate;
    }
  }
  return undefined;
}

function getConversationEntries(payload: any): any[] {
  const sources = [
    payload?.message?.conversation,
    payload?.conversation,
    payload?.message?.messages,
    payload?.messages,
    payload?.message?.artifact?.messages,
    payload?.artifact?.messages,
    payload?.message?.artifact?.messagesOpenAIFormatted,
    payload?.artifact?.messagesOpenAIFormatted,
  ];
  return sources.flatMap((source) => (Array.isArray(source) ? source : []));
}

function extractAddressFromConversation(payload: any): string | undefined {
  const conversation = getConversationEntries(payload);
  if (!conversation.length) return undefined;

  const messages = conversation
    .map((entry: any) => ({
      role: entry?.role || entry?.type,
      content: entry?.content || entry?.message || entry?.text,
    }))
    .filter((entry: any) => typeof entry.content === "string" && entry.content.trim().length > 0);

  const skipHints = ["repeat", "please", "can you", "could you", "need a clearer", "what street", "spell"];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const { role, content } = messages[i];
    if (role && String(role).toLowerCase() !== "user") continue;
    const text = String(content).trim();
    const lower = text.toLowerCase();
    if (lower.includes("address") || lower.includes("adress")) {
      if (skipHints.some((hint) => lower.includes(hint))) continue;
      return text;
    }
    if (lower.includes("delivery") && (lower.includes(" to ") || lower.startsWith("delivery to"))) {
      return text;
    }
  }

  return undefined;
}

function extractConversationText(payload: any): string | undefined {
  const conversation = getConversationEntries(payload);
  if (!conversation.length) return undefined;
  const userLines = conversation
    .map((entry: any) => ({
      role: entry?.role || entry?.type,
      content: entry?.content || entry?.message || entry?.text,
    }))
    .filter(
      (entry: any) =>
        typeof entry.content === "string" &&
        entry.content.trim().length > 0 &&
        (!entry.role || String(entry.role).toLowerCase() === "user")
    )
    .map((entry: any) => String(entry.content).trim());
  if (userLines.length) return userLines.join("\n");
  const allLines = conversation
    .map((entry: any) => entry?.content || entry?.message || entry?.text)
    .filter((content: any) => typeof content === "string" && content.trim().length > 0)
    .map((content: string) => content.trim());
  return allLines.length ? allLines.join("\n") : undefined;
}

function extractFulfillmentFromText(text?: string | null): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  const deliveryHints = ["delivery", "deliver", "hemkörning", "leverans", "hem", "till mig"];
  const pickupHints = ["pickup", "pick up", "avhämtning", "avhamtning", "hämta", "hamta", "ta själv"];
  if (deliveryHints.some((hint) => t.includes(hint))) return "delivery";
  if (pickupHints.some((hint) => t.includes(hint))) return "pickup";
  return undefined;
}

function extractPhoneFromText(text?: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(/(\+?\d[\d\s\-]{7,}\d)/);
  if (!match) return undefined;
  return normalizePhone(match[1]);
}

function extractAddressFromText(text?: string | null): string | undefined {
  if (!text) return undefined;
  const lines = text.split(/\n|[.!?]/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    const idx = Math.max(lower.indexOf("address"), lower.indexOf("adress"));
    if (idx >= 0) {
      const cleaned = line.slice(idx).replace(/^(address|adress)\s*(is|är|:)?\s*/i, "");
      const candidate = cleaned.trim();
      if (candidate) return candidate;
    }
  }
  return undefined;
}

async function upsertOrderFromStructuredOutput(params: {
  body: any;
  report: any;
  callId: string;
  organizationId: string;
  structuredOrder: StructuredOrderResult;
}) {
  const { body, report, callId, organizationId, structuredOrder } = params;
  const { data, outputId } = structuredOrder;
  const { items, address, fulfillment } = data;
  const customerName =
    data.customerName ||
    data.customer_name ||
    data.name ||
    body?.message?.customer?.name ||
    body?.customer?.name ||
    body?.message?.call?.customer?.name ||
    body?.call?.customer?.name ||
    report?.customer?.name ||
    report?.call?.customer?.name ||
    null;
  const customerPhone =
    data.phoneNumber ||
    data.phone_number ||
    data.phone ||
    data["phone number"] ||
    body?.message?.customer?.number ||
    body?.message?.call?.customer?.number ||
    body?.customer?.number ||
    body?.call?.customer?.number ||
    report?.customer?.number ||
    report?.call?.customer?.number ||
    body?.message?.customer?.phone ||
    body?.customer?.phone ||
    report?.customer?.phone ||
    report?.call?.customer?.phone ||
    null;
  const transcript =
    getTranscript(report) ||
    getTranscript(body) ||
    report?.transcript ||
    body?.transcript ||
    null;
  const summary =
    report?.analysis?.summary ||
    body?.analysis?.summary ||
    body?.message?.analysis?.summary ||
    null;
  const convoAddress = extractAddressFromConversation(body) || extractAddressFromConversation(report);
  const conversationText = extractConversationText(body) || extractConversationText(report);
  const extractedAddress =
    extractAddressFromText(summary) ||
    extractAddressFromText(transcript) ||
    extractAddressFromText(conversationText) ||
    extractAddressFromTranscript(transcript);
  const extractedFulfillment =
    extractFulfillmentFromText(summary) ||
    extractFulfillmentFromText(transcript) ||
    extractFulfillmentFromText(conversationText) ||
    "pickup";
  const extractedPhone =
    extractPhoneFromText(summary) ||
    extractPhoneFromText(transcript) ||
    extractPhoneFromText(conversationText);
  const addressValue = formatStructuredAddress(
    address ||
      data.deliveryAddress ||
      data.customerAddress ||
      data.customer?.address ||
      data.delivery?.address ||
      data.addressText ||
      data.delivery_address ||
      data.customer_address ||
      extractedAddress ||
      convoAddress
  );

  const orderId =
    body.order?.id ||
    report.order?.id ||
    body.orderId ||
    data.orderId ||
    callId;

  const parsedItems = normalizeOrderItems(items);
  if (process.env.DEBUG_ORDER_ITEM_PARSE === "1") {
    console.log(
      JSON.stringify({
        tag: "DEBUG_VAPI_ORDER_ITEM_PATH",
        timestamp: new Date().toISOString(),
        path: "end-of-call.structured_output",
        orderId,
        callId,
        itemsRaw: items ?? null,
        parsedItems,
        fulfillment,
        address,
      })
    );
  }
  if (!parsedItems || !fulfillment) {
    console.warn("[order] Structured data found but required fields are empty.");
    return;
  }

  const assistantId = extractAssistantId(body);
  if (!assistantId) console.warn("[VAPI] assistantId missing");
  const bt = getBusinessTypeFromAssistantId(assistantId);
  if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);

  const metadata = {
    structuredOutput: {
      id: outputId,
      itemsRaw: items,
      fulfillment,
      address: addressValue,
      customerName,
      customerPhone,
    },
    customerAddress: addressValue,
  };

  const structuredEvent = {
    ...body,
    order: {
      id: orderId,
      callId,
      items: parsedItems,
      metadata,
      customerId: body.message?.customer?.id || body.customer?.id || body.customerId,
      customerName,
      customerPhone,
      customerAddress: addressValue,
    },
    items: parsedItems,
    metadata,
    customerName,
    customerPhone,
    customerAddress: addressValue,
    confirmedAt: report.endedAt || report.endTime || new Date().toISOString(),
  };

  const existingOrder = await findOrderByOrderIdByOrganization(orderId, organizationId);
  if (existingOrder) {
    existingOrder.status = "confirmed";
    existingOrder.confirmedAt = structuredEvent.confirmedAt;
    existingOrder.items = parsedItems;
    existingOrder.metadata = { ...existingOrder.metadata, ...metadata };
    existingOrder.rawEvent = structuredEvent;
    existingOrder.callId = callId;
    existingOrder.businessType = bt ?? existingOrder.businessType;
    existingOrder.customerAddress = addressValue || existingOrder.customerAddress;
    existingOrder.customerName = customerName || existingOrder.customerName;
    existingOrder.customerPhone =
      customerPhone || extractedPhone || existingOrder.customerPhone;
    existingOrder.fulfillmentType =
      (fulfillment || extractedFulfillment || existingOrder.fulfillmentType)?.toLowerCase() as FulfillmentType || undefined;
    await updateOrder(existingOrder);
    console.log("[VAPI Webhook] end-of-call: Updated order from structured output", orderId);
    void runPrintPipeline(existingOrder, { organizationId }).catch((error) => {
      console.error(
        JSON.stringify({
          event: "print_exception",
          order_id: existingOrder.orderId,
          organization_id: existingOrder.tenantId,
          error: error?.message || String(error),
        })
      );
    });
    return;
  }

  const order = await createOrder(structuredEvent, { organizationId });
  order.businessType = bt ?? order.businessType;
  order.customerAddress = addressValue || order.customerAddress;
  order.customerName = customerName || order.customerName;
  order.customerPhone = customerPhone || order.customerPhone;
  order.fulfillmentType = (fulfillment || extractedFulfillment || order.fulfillmentType)?.toLowerCase() as FulfillmentType || undefined;
  await updateOrder(order);
  console.log("[VAPI Webhook] end-of-call: Created order from structured output", order.id);
  void runPrintPipeline(order, { organizationId }).catch((error) => {
    console.error(
      JSON.stringify({
        event: "print_exception",
        order_id: order.orderId,
        organization_id: order.tenantId,
        error: error?.message || String(error),
      })
    );
  });
}

/**
 * Handle call.started event
 */
async function handleCallStarted(event: any, organizationId: string) {
  try {
    const callId = event.call?.id || event.id || event.callId;
    
    if (!callId) {
      console.error("[VAPI Webhook] call.started: Missing call ID");
      return NextResponse.json(
        { success: false, error: "Missing call ID" },
        { status: 400 }
      );
    }

    // Check if call already exists
    let existingCall = await findCallByCallIdByOrganization(callId, organizationId);
    
    if (existingCall) {
      // Update existing call
      existingCall.status = "started";
      existingCall.startedAt = event.startedAt || event.timestamp || new Date().toISOString();
      
      // Business type transition logic using scoring system
      const detection = detectBusinessTypeFromCall(event);
      const existingType = existingCall.businessType || "router";
      const eventType = event.type || event.event || event.eventType || "unknown";
      
      if (shouldSwitch(existingType, detection.businessType, detection.scores)) {
        // Allow switch - update business type and scores
        if (existingType !== detection.businessType) {
          console.log(
            `[businessType] callId=${callId} event=${eventType} old=${existingType} new=${detection.businessType} scores=${JSON.stringify(detection.scores)} conf=${detection.confidence.toFixed(3)}`
          );
        }
        existingCall.businessType = detection.businessType;
        existingCall.scores = detection.scores;
        existingCall.detectedFrom = detection.detectedFrom;
        existingCall.confidence = detection.confidence;
      } else {
        // Prevent switch - keep existing type
        console.log(
          `[businessType] prevent switch callId=${callId} event=${eventType} old=${existingType} new=${detection.businessType} scores=${JSON.stringify(detection.scores)} conf=${detection.confidence.toFixed(3)}`
        );
        // Keep existing businessType, but update scores if they're missing
        if (!existingCall.scores) {
          existingCall.scores = detection.scores;
        }
      }
      
      existingCall.phoneNumber = event.call?.phoneNumber || event.phoneNumber || existingCall.phoneNumber;
      existingCall.customerId = event.call?.customerId || event.customerId || existingCall.customerId;
      existingCall.metadata = { ...existingCall.metadata, ...(event.call?.metadata || event.metadata) };
      existingCall.rawEvent = event;
      await updateCall(existingCall);
      
      console.log("[VAPI Webhook] call.started: Updated existing call", callId);
      return NextResponse.json({ 
        success: true, 
        message: "Call updated",
        callId: existingCall.id 
      });
    } else {
      // Create new call
      const call = await createCall(event, { organizationId });
      const detection = detectBusinessTypeFromCall(event);
      const eventType = event.type || event.event || event.eventType || "call.started";
      
      console.log(
        `[businessType] callId=${callId} event=${eventType} old=router new=${detection.businessType} scores=${JSON.stringify(detection.scores)} conf=${detection.confidence.toFixed(3)}`
      );
      
      call.businessType = detection.businessType;
      call.scores = detection.scores;
      call.detectedFrom = detection.detectedFrom;
      call.confidence = detection.confidence;
      await updateCall(call);
      console.log("[VAPI Webhook] call.started: Created new call", call.id, "for VAPI call", callId);
      return NextResponse.json({ 
        success: true, 
        message: "Call stored",
        callId: call.id 
      });
    }
  } catch (error: any) {
    console.error("[VAPI Webhook] call.started: Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process call.started" },
      { status: 500 }
    );
  }
}

/**
 * Handle call.ended event
 */
async function handleCallEnded(event: any, organizationId: string) {
  try {
    const callId = event.call?.id || event.id || event.callId;
    
    if (!callId) {
      console.error("[VAPI Webhook] call.ended: Missing call ID");
      return NextResponse.json(
        { success: false, error: "Missing call ID" },
        { status: 400 }
      );
    }

    // Find existing call
    const existingCall = await findCallByCallIdByOrganization(callId, organizationId);
    
    if (!existingCall) {
      console.warn("[VAPI Webhook] call.ended: Call not found", callId);
      return NextResponse.json(
        { success: false, error: "Call not found" },
        { status: 404 }
      );
    }

    // Update call with ended status
    existingCall.status = "ended";
    existingCall.endedAt = event.endedAt || event.timestamp || new Date().toISOString();
    
    // Calculate duration
    if (existingCall.startedAt && existingCall.endedAt) {
      const startTime = new Date(existingCall.startedAt).getTime();
      const endTime = new Date(existingCall.endedAt).getTime();
      existingCall.durationSeconds = Math.floor((endTime - startTime) / 1000);
    }

    // Update business type if new detection is available (using scoring system)
    const detection = detectBusinessTypeFromCall(event);
    const existingType = existingCall.businessType || "router";
    const eventType = event.type || event.event || event.eventType || "call.ended";
    
    if (shouldSwitch(existingType, detection.businessType, detection.scores)) {
      // Allow switch - update business type and scores
      if (existingType !== detection.businessType) {
        console.log(
          `[businessType] callId=${callId} event=${eventType} old=${existingType} new=${detection.businessType} scores=${JSON.stringify(detection.scores)} conf=${detection.confidence.toFixed(3)}`
        );
      }
      existingCall.businessType = detection.businessType;
      existingCall.scores = detection.scores;
      existingCall.detectedFrom = detection.detectedFrom;
      existingCall.confidence = detection.confidence;
    } else {
      // Prevent switch - keep existing type
      console.log(
        `[businessType] prevent switch callId=${callId} event=${eventType} old=${existingType} new=${detection.businessType} scores=${JSON.stringify(detection.scores)} conf=${detection.confidence.toFixed(3)}`
      );
      // Keep existing businessType, but update scores if they're missing
      if (!existingCall.scores) {
        existingCall.scores = detection.scores;
      }
    }

    await updateCall(existingCall);
    console.log("[VAPI Webhook] call.ended: Updated call", callId, "duration:", existingCall.durationSeconds, "seconds");
    return NextResponse.json({ 
      success: true, 
      message: "Call ended",
      callId: existingCall.id,
      duration: existingCall.durationSeconds 
    });
  } catch (error: any) {
    console.error("[VAPI Webhook] call.ended: Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process call.ended" },
      { status: 500 }
    );
  }
}

/**
 * Handle order.confirmed event
 */
async function handleOrderConfirmed(
  event: any,
  org: { id: string; slug?: string | null }
) {
  try {
    const orderId = extractOrderId(event);
    const incomingName =
      event.order?.customerName ||
      event.order?.customer?.name ||
      event.customerName ||
      event.customer?.name ||
      event.message?.customer?.name ||
      event.call?.customer?.name ||
      null;
    const incomingAddress =
      event.order?.customerAddress ||
      event.customerAddress ||
      event.order?.deliveryAddress ||
      event.deliveryAddress ||
      event.order?.customer?.address ||
      event.customer?.address ||
      null;
    const incomingPhone =
      event.order?.customerPhone ||
      event.customerPhone ||
      event.order?.customer?.phone ||
      event.customer?.phone ||
      event.order?.customer?.number ||
      event.customer?.number ||
      event.order?.phoneNumber ||
      event.phoneNumber ||
      event.order?.call?.customer?.number ||
      event.call?.customer?.number ||
      null;
    
    if (!orderId) {
      console.error("[VAPI Webhook] order.confirmed: Missing order ID");
      return NextResponse.json(
        { success: false, error: "Missing order ID" },
        { status: 400 }
      );
    }

    if (!didDebugOrderPayload && process.env.DEBUG_ORDER_PAYLOAD_ONCE === "1") {
      // Temporary debugging for VAPI payload structure; remove after validation.
      didDebugOrderPayload = true;
      const redactedBody = redactPayload(event);
      console.log(
        JSON.stringify({
          tag: "DEBUG_VAPI_ORDER_PAYLOAD_ONCE",
          timestamp: new Date().toISOString(),
          org: { id: org.id, slug: org.slug || null },
          body: redactedBody,
        })
      );
      console.log(
        JSON.stringify({
          tag: "DEBUG_VAPI_ORDER_EXTRACT",
          timestamp: new Date().toISOString(),
          orderId,
          callId: event.order?.callId || event.callId || null,
          items: event.order?.items || event.items || null,
          total_amount: event.order?.totalAmount || event.totalAmount || null,
          currency: event.order?.currency || event.currency || null,
          fulfillment_type:
            event.order?.fulfillmentType || event.fulfillmentType || null,
          customer_name: event.order?.customerName || event.customerName || null,
          customer_phone: event.order?.customerPhone || event.customerPhone || null,
          customer_address:
            event.order?.customerAddress || event.customerAddress || null,
          scheduled_for:
            event.order?.scheduledFor || event.scheduledFor || null,
          notes:
            event.order?.specialInstructions ||
            event.specialInstructions ||
            event.order?.notes ||
            event.notes ||
            null,
          allergies: event.order?.allergies || event.allergies || null,
        })
      );
    }

    const assistantId = extractAssistantId(event);
    if (!assistantId) console.warn("[VAPI] assistantId missing");
    const bt = getBusinessTypeFromAssistantId(assistantId);
    if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);

    // Check if order already exists
    let existingOrder = await findOrderByOrderIdByOrganization(orderId, org.id);
    
    if (existingOrder) {
      // Update existing order
      existingOrder.status = "confirmed";
      existingOrder.confirmedAt = event.confirmedAt || event.timestamp || new Date().toISOString();
      
      existingOrder.businessType = bt ?? existingOrder.businessType;
      
      const callId = event.order?.callId || event.callId || existingOrder.callId;
      
      existingOrder.callId = callId || existingOrder.callId;
      existingOrder.customerId =
        event.order?.customerId || event.customerId || existingOrder.customerId;
      if (incomingName && !existingOrder.customerName) {
        existingOrder.customerName = incomingName;
      }
      existingOrder.customerAddress =
        incomingAddress || existingOrder.customerAddress;
      existingOrder.customerPhone =
        incomingPhone || existingOrder.customerPhone;

      const incomingItems = event.order?.items || event.items;
      const transcript = extractTranscript(event);
      const useExtracted =
        (bt ?? existingOrder.businessType) === "restaurant" && Boolean(transcript);

      if (useExtracted && transcript) {
        const extracted = extractOrderFromTranscript(transcript);
        if (process.env.DEBUG_ORDER_ITEM_PARSE === "1") {
          console.log(
            JSON.stringify({
              tag: "DEBUG_VAPI_ORDER_ITEM_PATH",
              timestamp: new Date().toISOString(),
              path: "order.confirmed.transcript_extract",
              orderId,
              callId: existingOrder.callId || event.order?.callId || event.callId || null,
              hasTranscript: Boolean(transcript),
              extractedItemsCount: extracted.items.length,
              extractedItems: extracted.items,
              incomingItemsRaw: incomingItems ?? null,
            })
          );
        }
        existingOrder.items = extracted.items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          description: buildItemNotes(item),
        }));
        if (extracted.fulfillment) {
          existingOrder.fulfillmentType = extracted.fulfillment as FulfillmentType;
        }
        existingOrder.metadata = {
          ...existingOrder.metadata,
          ...(event.order?.metadata || event.metadata),
          extraction: {
            fulfillment: extracted.fulfillment,
            requestedTime: extracted.requestedTime,
            confidence: extracted.confidence,
          },
        };
      } else {
        if (process.env.DEBUG_ORDER_ITEM_PARSE === "1") {
          console.log(
            JSON.stringify({
              tag: "DEBUG_VAPI_ORDER_ITEM_PATH",
              timestamp: new Date().toISOString(),
              path: "order.confirmed.incoming_items",
              orderId,
              callId: existingOrder.callId || event.order?.callId || event.callId || null,
              hasTranscript: Boolean(transcript),
              incomingItemsRaw: incomingItems ?? null,
              incomingItemsType: Array.isArray(incomingItems)
                ? "array"
                : incomingItems
                ? typeof incomingItems
                : "null",
            })
          );
        }
        existingOrder.items = incomingItems || existingOrder.items;
        existingOrder.metadata = {
          ...existingOrder.metadata,
          ...(event.order?.metadata || event.metadata),
        };
      }

      existingOrder.totalAmount =
        event.order?.totalAmount || event.totalAmount || existingOrder.totalAmount;
      existingOrder.currency =
        event.order?.currency || event.currency || existingOrder.currency || "USD";
      existingOrder.rawEvent = event;
      await updateOrder(existingOrder);
      void runPrintPipeline(existingOrder, { organizationId: org.id })
        .then((result) => {
          if (!result.ok) {
            console.error(
              JSON.stringify({
                event: "print_failed",
                order_id: existingOrder.orderId,
                organization_id: existingOrder.tenantId,
                error: result.error || "print_failed",
              })
            );
          }
        })
        .catch((error) => {
          console.error(
            JSON.stringify({
              event: "print_exception",
              order_id: existingOrder.orderId,
                organization_id: existingOrder.tenantId,
              error: error?.message || String(error),
            })
          );
        });
      
      console.log("[VAPI Webhook] order.confirmed: Updated existing order", orderId);
      return NextResponse.json({ 
        success: true, 
        message: "Order updated",
        orderId: existingOrder.id 
      });
    } else {
      // Create new order
      const order = await createOrder(event, { organizationId: org.id });
      order.customerName = incomingName || order.customerName;
      order.customerAddress = incomingAddress || order.customerAddress;
      order.customerPhone = incomingPhone || order.customerPhone;
      const transcript = extractTranscript(event);
      const useExtracted =
        (order.businessType || bt) === "restaurant" && Boolean(transcript);

      if (useExtracted && transcript) {
        const extracted = extractOrderFromTranscript(transcript);
        if (process.env.DEBUG_ORDER_ITEM_PARSE === "1") {
          console.log(
            JSON.stringify({
              tag: "DEBUG_VAPI_ORDER_ITEM_PATH",
              timestamp: new Date().toISOString(),
              path: "order.confirmed.transcript_extract",
              orderId,
              callId: order.callId || event.order?.callId || event.callId || null,
              hasTranscript: Boolean(transcript),
              extractedItemsCount: extracted.items.length,
              extractedItems: extracted.items,
              incomingItemsRaw: event.order?.items || event.items || null,
            })
          );
        }
        order.items = extracted.items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          description: buildItemNotes(item),
        }));
        if (extracted.fulfillment) {
          order.fulfillmentType = extracted.fulfillment as FulfillmentType;
        }
        order.metadata = {
          ...order.metadata,
          extraction: {
            fulfillment: extracted.fulfillment,
            requestedTime: extracted.requestedTime,
            confidence: extracted.confidence,
          },
        };
        await updateOrder(order);
      } else if (incomingName || incomingAddress) {
        await updateOrder(order);
      } else if (incomingPhone) {
        await updateOrder(order);
      }
      if (!useExtracted && process.env.DEBUG_ORDER_ITEM_PARSE === "1") {
        const incomingItems = event.order?.items || event.items;
        console.log(
          JSON.stringify({
            tag: "DEBUG_VAPI_ORDER_ITEM_PATH",
            timestamp: new Date().toISOString(),
            path: "order.confirmed.incoming_items",
            orderId,
            callId: order.callId || event.order?.callId || event.callId || null,
            hasTranscript: Boolean(transcript),
            incomingItemsRaw: incomingItems ?? null,
            incomingItemsType: Array.isArray(incomingItems)
              ? "array"
              : incomingItems
              ? typeof incomingItems
              : "null",
          })
        );
      }
      
      // Optionally link to call if callId is provided
      if (order.callId) {
        const call = await findCallByCallIdByOrganization(order.callId, org.id);
        if (call) {
          console.log("[VAPI Webhook] order.confirmed: Linked order to call", call.id);
        }
      }
      
      void runPrintPipeline(order, { organizationId: org.id })
        .then((result) => {
          if (!result.ok) {
            console.error(
              JSON.stringify({
                event: "print_failed",
                order_id: order.orderId,
                organization_id: order.tenantId,
                error: result.error || "print_failed",
              })
            );
          }
        })
        .catch((error) => {
          console.error(
            JSON.stringify({
              event: "print_exception",
              order_id: order.orderId,
              organization_id: order.tenantId,
              error: error?.message || String(error),
            })
          );
        });
      console.log("[VAPI Webhook] order.confirmed: Created new order", order.id, "for VAPI order", orderId);
      return NextResponse.json({ 
        success: true, 
        message: "Order stored",
        orderId: order.id 
      });
    }
  } catch (error: any) {
    console.error("[VAPI Webhook] order.confirmed: Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process order.confirmed" },
      { status: 500 }
    );
  }
}

type VapiWebhookPayload = any;

type FinalizedOrder = {
  status: "CONFIRMED" | "DRAFT";
  itemsText: string;
  totalText?: string;
  customerPhone?: string;
  customerName?: string;
  fulfillment?: "pickup" | "delivery";
  requestedTime?: string;
  deliveryAddress?: string;
};

async function handleEndOfCall(
  payload: VapiWebhookPayload,
  org: { id: string; slug?: string | null }
) {
  const callId = payload.extractedCallId || payload.callId || payload.call?.id;
  if (!callId) return NextResponse.json({ ok: true });

  if (!didDebugOrderPayload && process.env.DEBUG_ORDER_PAYLOAD_ONCE === "1") {
    // Temporary debugging for end-of-call payload; remove after validation.
    didDebugOrderPayload = true;
    const redactedBody = redactPayload(payload);
    console.log(
      JSON.stringify({
        tag: "DEBUG_VAPI_END_OF_CALL_PAYLOAD_ONCE",
        timestamp: new Date().toISOString(),
        org: { id: org.id, slug: org.slug || null },
        body: redactedBody,
      })
    );
    console.log(
      JSON.stringify({
        tag: "DEBUG_VAPI_END_OF_CALL_EXTRACT",
        timestamp: new Date().toISOString(),
        callId,
        analysisKeys: Object.keys(payload?.analysis || {}),
        structuredKeys: Object.keys(payload?.analysis?.structuredOutputs || {}),
        transcriptKeys: {
          callTranscript: Boolean(payload?.call?.transcript),
          transcript: Boolean(payload?.transcript),
          analysisTranscript: Boolean(payload?.analysis?.transcript),
          endOfCallTranscript: Boolean(payload?.endOfCallReport?.transcript),
        },
      })
    );
  }

  if (org.slug !== "chilli") {
    return NextResponse.json({ ok: true });
  }

  await initDatabase();
  const pool = getPool();
  const existing = await pool.query(
    "SELECT id FROM orders WHERE organization_id = $1 AND call_id = $2 LIMIT 1",
    [org.id, callId]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const transcript = getTranscript(payload);
  const structured = tryExtractStructuredOrder(payload);
  const fallback = structured ? null : chilliTranscriptFallback(transcript);
  const finalized = structured || fallback;

  if (!finalized) {
    return NextResponse.json({ ok: true });
  }

  const parsedTotal = parseTotalAmount(finalized.totalText);
  const currency = detectCurrency(finalized.totalText);
  const items = parseItemsText(finalized.itemsText);
  const extraction = {
    itemsText: finalized.itemsText,
    status: finalized.status,
    fulfillment: finalized.fulfillment,
    requestedTime: finalized.requestedTime,
    confidence: payload?.analysis?.confidence ?? null,
    transcript,
  };

  const orderEvent = {
    ...payload,
    order: {
      ...payload.order,
      id: callId,
      items,
      totalAmount: parsedTotal ?? undefined,
      currency: currency || undefined,
      metadata: {
        ...(payload.order?.metadata || {}),
        extraction,
      },
    },
    callId,
    confirmedAt: new Date().toISOString(),
  };

  const created = await createOrder(orderEvent, { organizationId: org.id });
  const summary =
    payload?.analysis?.summary ||
    payload?.message?.analysis?.summary ||
    payload?.message?.analysisSummary ||
    null;
  const convoText = extractConversationText(payload);
  const extractedFulfillment =
    extractFulfillmentFromText(summary) ||
    extractFulfillmentFromText(getTranscript(payload)) ||
    extractFulfillmentFromText(convoText) ||
    "pickup";
  const extractedAddress =
    extractAddressFromText(summary) ||
    extractAddressFromText(getTranscript(payload)) ||
    extractAddressFromText(convoText) ||
    extractAddressFromConversation(payload);
  const extractedPhone =
    extractPhoneFromText(summary) ||
    extractPhoneFromText(getTranscript(payload)) ||
    extractPhoneFromText(convoText);

  created.customerPhone =
    finalized.customerPhone ||
    normalizePhone(
      payload?.call?.customer?.number ||
        payload?.message?.call?.customer?.number ||
        payload?.message?.customer?.number ||
        payload?.customer?.number
    ) ||
    extractedPhone;
  created.customerName = finalized.customerName || undefined;
  created.fulfillmentType = (finalized.fulfillment || extractedFulfillment)?.toLowerCase() as FulfillmentType || undefined;
  created.customerAddress = finalized.deliveryAddress || extractedAddress || undefined;
  if (finalized.status === "CONFIRMED") {
    created.status = "confirmed";
  } else {
    created.status = "confirmed";
  }
  created.metadata = {
    ...created.metadata,
    extraction,
  };
  await updateOrder(created);

  void runPrintPipeline(created, { organizationId: org.id })
    .then((result) => {
      if (!result.ok) {
        console.error(
          JSON.stringify({
            event: "print_failed",
            order_id: created.orderId,
            organization_id: created.tenantId,
            error: result.error || "print_failed",
          })
        );
      }
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "print_exception",
          order_id: created.orderId,
          organization_id: created.tenantId,
          error: error?.message || String(error),
        })
      );
    });

  return NextResponse.json({ ok: true });
}

function extractTranscript(payload: any): string | null {
  const transcript =
    payload?.transcript?.text ||
    payload?.transcript ||
    payload?.message?.transcript?.text ||
    payload?.message?.transcript ||
    payload?.endOfCallReport?.transcript?.text ||
    payload?.endOfCallReport?.transcript ||
    payload?.data?.transcript?.text ||
    payload?.data?.transcript ||
    payload?.order?.transcript ||
    payload?.order?.notes ||
    payload?.notes;
  return typeof transcript === "string" && transcript.trim().length > 0
    ? transcript
    : null;
}

function normalizePhone(p?: string) {
  if (!p) return undefined;
  return p.replace(/\s+/g, "");
}

function getTranscript(payload: VapiWebhookPayload): string {
  return (
    payload?.call?.transcript ||
    payload?.transcript ||
    payload?.analysis?.transcript ||
    payload?.message?.analysis?.transcript ||
    payload?.message?.analysis?.summary ||
    extractTranscript(payload) ||
    ""
  );
}

function tryExtractStructuredOrder(payload: VapiWebhookPayload): FinalizedOrder | null {
  const analysis =
    payload?.message?.analysis || payload?.analysis || payload?.call?.analysis || null;

  const structuredData = analysis?.structuredData ?? null;
  const structuredOutputs = analysis?.structuredOutputs ?? null;
  const directOrder = analysis?.order || payload?.call?.analysis?.order;
  const orderStructuredOutputId =
    process.env.VAPI_CHILLI_ORDER_STRUCTURED_OUTPUT_ID || null;

  const orderFromOutputs =
    orderStructuredOutputId && structuredOutputs?.[orderStructuredOutputId]
      ? structuredOutputs[orderStructuredOutputId]
      : null;
  const orderByName = structuredOutputs?.order || structuredOutputs?.Order || null;

  let so = orderFromOutputs ?? orderByName ?? structuredData ?? directOrder;
  if (!so) {
    console.log("[order] No structured order found", {
      hasStructuredData: Boolean(structuredData),
      structuredOutputsKeys: structuredOutputs ? Object.keys(structuredOutputs) : [],
    });
    return null;
  }

  if (!Array.isArray(so) && typeof so === "object" && !so.order && !so.itemsText && !so.items) {
    const values = Object.values(so);
    so =
      values.find((x: any) => x?.type === "order" || x?.order || x?.itemsText || x?.items) ||
      so;
  }

  const orderObj = Array.isArray(so)
    ? so.find((x: any) => x?.type === "order" || x?.order || x?.itemsText || x?.items)
    : so;
  const o = orderObj?.order || orderObj;
  if (!o) return null;

  const itemsText =
    o.itemsText ||
    (Array.isArray(o.items)
      ? o.items
          .map((i: any) => `- ${i.quantity ?? 1}x ${i.name}${i.notes ? ` (${i.notes})` : ""}`)
          .join("\n")
      : "");

  const status = (o.status || "").toUpperCase() === "CONFIRMED" ? "CONFIRMED" : "DRAFT";
  if (!itemsText) return null;

  return {
    status,
    itemsText,
    totalText: o.totalText || o.total || undefined,
    customerPhone: normalizePhone(o.customerPhone || payload?.call?.customer?.number),
    customerName: o.customerName,
    fulfillment: o.fulfillment,
    requestedTime: o.requestedTime,
    deliveryAddress:
      o.deliveryAddress ||
      o.address ||
      o.customerAddress ||
      o.customer?.address ||
      o.delivery?.address ||
      o.addressText,
  };
}

function chilliTranscriptFallback(transcript: string): FinalizedOrder | null {
  const t = transcript.toLowerCase();
  const confirmed =
    t.includes("jag bekräftar") ||
    t.includes("bekräftar din beställning") ||
    t.includes("order är bekräftad") ||
    t.includes("tack för din beställning");

  const menuHits = [
    "margherita",
    "vesuvio",
    "capricciosa",
    "hawaii",
    "bussola",
    "calzone",
    "al tonno",
    "opera",
    "pompei",
    "chicko banana",
    "gudfadern",
    "salami",
    "bolognese",
    "vegetarisk",
    "funge",
  ].filter((name) => t.includes(name));

  if (!confirmed || menuHits.length === 0) return null;

  const itemsText = menuHits.map((x) => `- 1x ${x}`).join("\n");

  const fulfillment =
    t.includes("hemkörning") || t.includes("leverans") || t.includes("delivery")
      ? "delivery"
      : "pickup";

  return {
    status: "CONFIRMED",
    itemsText,
    fulfillment,
  };
}

function parseItemsText(itemsText: string) {
  const lines = itemsText.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/-?\s*(\d+)\s*x?\s*(.+?)(?:\s*\((.+)\))?$/i);
    if (!match) {
      return { name: line, quantity: 1 };
    }
    const quantity = Number(match[1]) || 1;
    const name = match[2]?.trim() || "unknown";
    const description = match[3]?.trim();
    return {
      name,
      quantity,
      description,
    };
  });
}

function parseTotalAmount(totalText?: string) {
  if (!totalText) return null;
  const match = totalText.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function detectCurrency(totalText?: string) {
  if (!totalText) return null;
  const lower = totalText.toLowerCase();
  if (lower.includes("kr") || lower.includes("sek")) return "SEK";
  if (lower.includes("eur") || lower.includes("€")) return "EUR";
  if (lower.includes("usd") || lower.includes("$")) return "USD";
  return null;
}

function buildItemNotes(item: {
  size?: "ordinarie" | "familj";
  glutenFree?: boolean;
  mozzarella?: boolean;
  notes?: string;
}) {
  const parts: string[] = [];
  if (item.size) parts.push(item.size);
  if (item.glutenFree) parts.push("glutenfri");
  if (item.mozzarella) parts.push("mozzarella");
  if (item.notes) parts.push(item.notes);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * GET endpoint for webhook verification or health check
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    status: "ok", 
    service: "VAPI Webhook Handler",
    supportedEvents: ["call.started", "call.ended", "order.confirmed"],
    timestamp: new Date().toISOString()
  });
}

