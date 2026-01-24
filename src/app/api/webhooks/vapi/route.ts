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

export const runtime = "nodejs";

/**
 * In-memory store for seen events to prevent duplicate processing
 * Keyed by: event.id or ${event.type}:${callId}:${timestamp}
 */
const seenEvents = new Set<string>();

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
    const org = await resolveOrgContextForWebhook(req, body);
    const body = await req.json();
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
    const orderId = body.order?.id || body.id || body.orderId;
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
        return handleCallEnded(
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
      return handleOrderConfirmed(body, org.id);
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
async function handleOrderConfirmed(event: any, organizationId: string) {
  try {
    const orderId = event.order?.id || event.id || event.orderId;
    
    if (!orderId) {
      console.error("[VAPI Webhook] order.confirmed: Missing order ID");
      return NextResponse.json(
        { success: false, error: "Missing order ID" },
        { status: 400 }
      );
    }

    // Check if order already exists
    let existingOrder = await findOrderByOrderIdByOrganization(orderId, organizationId);
    
    if (existingOrder) {
      // Update existing order
      existingOrder.status = "confirmed";
      existingOrder.confirmedAt = event.confirmedAt || event.timestamp || new Date().toISOString();
      
      // Set businessType from assistantId mapping
      const assistantId = extractAssistantId(event);
      if (!assistantId) console.warn("[VAPI] assistantId missing");
      const bt = getBusinessTypeFromAssistantId(assistantId);
      if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);
      existingOrder.businessType = bt ?? existingOrder.businessType;
      
      const callId = event.order?.callId || event.callId || existingOrder.callId;
      
      existingOrder.callId = callId || existingOrder.callId;
      existingOrder.customerId = event.order?.customerId || event.customerId || existingOrder.customerId;
      existingOrder.items = event.order?.items || event.items || existingOrder.items;
      existingOrder.totalAmount = event.order?.totalAmount || event.totalAmount || existingOrder.totalAmount;
      existingOrder.currency = event.order?.currency || event.currency || existingOrder.currency || "USD";
      existingOrder.metadata = { ...existingOrder.metadata, ...(event.order?.metadata || event.metadata) };
      existingOrder.rawEvent = event;
      await updateOrder(existingOrder);
      void runPrintPipeline(existingOrder, { organizationId })
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
      const order = await createOrder(event, { organizationId });
      
      // Optionally link to call if callId is provided
      if (order.callId) {
        const call = await findCallByCallIdByOrganization(order.callId, organizationId);
        if (call) {
          console.log("[VAPI Webhook] order.confirmed: Linked order to call", call.id);
        }
      }
      
      void runPrintPipeline(order, { organizationId })
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

