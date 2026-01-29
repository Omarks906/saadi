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

      const incomingItems = event.order?.items || event.items;
      const transcript = extractTranscript(event);
      const useExtracted =
        (bt ?? existingOrder.businessType) === "restaurant" && Boolean(transcript);

      if (useExtracted && transcript) {
        const extracted = extractOrderFromTranscript(transcript);
        existingOrder.items = extracted.items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          description: buildItemNotes(item),
        }));
        if (extracted.fulfillment) {
          existingOrder.fulfillmentType = extracted.fulfillment;
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
      const transcript = extractTranscript(event);
      const useExtracted =
        (order.businessType || bt) === "restaurant" && Boolean(transcript);

      if (useExtracted && transcript) {
        const extracted = extractOrderFromTranscript(transcript);
        order.items = extracted.items.map((item) => ({
          name: item.name,
          quantity: item.qty,
          description: buildItemNotes(item),
        }));
        if (extracted.fulfillment) {
          order.fulfillmentType = extracted.fulfillment;
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
  created.customerPhone =
    finalized.customerPhone || normalizePhone(payload?.call?.customer?.number);
  created.customerName = finalized.customerName || undefined;
  created.fulfillmentType = finalized.fulfillment || undefined;
  created.customerAddress = finalized.deliveryAddress || undefined;
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
    deliveryAddress: o.deliveryAddress,
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

