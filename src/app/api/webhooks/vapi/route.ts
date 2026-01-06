import { NextRequest, NextResponse } from "next/server";
import { createCall, findCallByCallId, updateCall, extractAssistantId } from "@/lib/vapi-storage";
import { createOrder, findOrderByOrderId, updateOrder } from "@/lib/vapi-storage";
import { getBusinessTypeFromAssistantId } from "@/lib/vapi-assistant-map";
import { detectBusinessTypeFromCall } from "@/lib/business-type-detector";

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
    console.log("[VAPI Webhook] Received event:", eventType || "unknown", {
      timestamp: new Date().toISOString(),
      eventKey,
      hasType: !!body.type,
      hasEvent: !!body.event,
      hasEventType: !!body.eventType,
      messageType: body.message?.type,
      callId: body.call?.id || body.id,
    });

    // Mark event as seen before processing
    markEventSeen(eventKey);

    // Handle status-update events (VAPI sends these for call state changes)
    if (eventType === "status-update" || body.message?.type === "status-update") {
      const statusUpdate = body.statusUpdate || body.message?.statusUpdate || body;
      const status = statusUpdate.status || body.status || body.message?.status;
      const callId = statusUpdate.call?.id || body.call?.id || body.id || body.message?.call?.id;
      
      if (callId && (status === "started" || status === "ringing" || status === "answered")) {
        return handleCallStarted({
          ...body,
          call: { ...body.call, ...statusUpdate.call, id: callId },
          type: "call.started",
        });
      }
      
      if (callId && (status === "ended" || status === "ended-by-user" || status === "ended-by-system")) {
        return handleCallEnded({
          ...body,
          call: { ...body.call, ...statusUpdate.call, id: callId },
          type: "call.ended",
        });
      }
    }

    // Handle end-of-call-report (VAPI sends this at the end of calls)
    if (eventType === "end-of-call-report" || body.message?.type === "end-of-call-report") {
      const report = body.endOfCallReport || body.message?.endOfCallReport || body;
      const callId = report.call?.id || report.id || body.id || body.message?.call?.id;
      
      if (callId) {
        // Create or update call with end-of-call report data
        return handleCallEnded({
          ...body,
          call: { ...report.call, id: callId },
          type: "call.ended",
          endedAt: report.endedAt || report.endTime || new Date().toISOString(),
          startedAt: report.startedAt || report.startTime,
        });
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
      return handleCallStarted(body);
    }

    // Handle call.ended event (multiple possible formats)
    if (
      eventType === "call.ended" || 
      eventType === "call-end" ||
      body.event === "call.ended" ||
      body.message?.type === "call.ended" ||
      (body.status === "ended" && body.call)
    ) {
      return handleCallEnded(body);
    }

    // Handle order.confirmed event (multiple possible formats)
    if (
      eventType === "order.confirmed" || 
      eventType === "order-confirmed" ||
      body.event === "order.confirmed" ||
      body.message?.type === "order.confirmed"
    ) {
      return handleOrderConfirmed(body);
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
        details: error?.stack 
      },
      { status: 500 }
    );
  }
}

/**
 * Handle call.started event
 */
async function handleCallStarted(event: any) {
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
    let existingCall = findCallByCallId(callId);
    
    if (existingCall) {
      // Update existing call
      existingCall.status = "started";
      existingCall.startedAt = event.startedAt || event.timestamp || new Date().toISOString();
      
      // Business type transition logic:
      // - Allow: router → car or router → restaurant
      // - Disallow: car → router, restaurant → router
      // - If car ↔ restaurant conflict, keep the first and log it
      const detection = detectBusinessTypeFromCall(event);
      const existingType = existingCall.businessType || "router";
      const eventType = event.type || event.event || event.eventType || "unknown";
      
      if (existingType === "car" || existingType === "restaurant") {
        // Don't overwrite car/restaurant with router
        if (detection.businessType === "router") {
          // Keep existing type, don't overwrite
          console.log(
            `[businessType] prevent overwrite callId=${callId} event=${eventType} old=${existingType} new=router`
          );
        } else if (detection.businessType !== existingType) {
          // Conflict: car ↔ restaurant
          // Only allow change if new classification has much higher confidence (diff ≥ 3)
          const hitDiff = 
            existingType === "car" 
              ? detection.restaurantHits - detection.carHits
              : detection.carHits - detection.restaurantHits;
          
          if (hitDiff >= 3) {
            // Allow change - new classification has significantly higher confidence
            console.log(
              `[businessType] callId=${callId} event=${eventType} old=${existingType} new=${detection.businessType} car=${detection.carHits} rest=${detection.restaurantHits} conf=${detection.confidence} (allowed: diff=${hitDiff}>=3)`
            );
            existingCall.businessType = detection.businessType;
            existingCall.carHits = detection.carHits;
            existingCall.restaurantHits = detection.restaurantHits;
            existingCall.detectedFrom = detection.detectedFrom;
            existingCall.confidence = detection.confidence;
          } else {
            // Keep existing type - new classification doesn't have enough confidence
            console.warn(
              `[businessType] conflict callId=${callId} old=${existingType} new=${detection.businessType} car=${detection.carHits} rest=${detection.restaurantHits} (diff=${hitDiff}<3, keeping ${existingType})`
            );
            // Keep existing type
          }
        } else {
          // Same type, update hit counts and confidence
          existingCall.businessType = detection.businessType;
          existingCall.carHits = detection.carHits;
          existingCall.restaurantHits = detection.restaurantHits;
          existingCall.detectedFrom = detection.detectedFrom;
          existingCall.confidence = detection.confidence;
        }
        // Keep existing businessType (already set above if needed)
      } else {
        // Existing type is "router" or null/undefined - allow transition to car/restaurant
        if (detection.businessType !== existingType) {
          console.log(
            `[businessType] callId=${callId} event=${eventType} old=${existingType} new=${detection.businessType} car=${detection.carHits} rest=${detection.restaurantHits} conf=${detection.confidence}`
          );
        }
        existingCall.businessType = detection.businessType;
        existingCall.carHits = detection.carHits;
        existingCall.restaurantHits = detection.restaurantHits;
        existingCall.detectedFrom = detection.detectedFrom;
        existingCall.confidence = detection.confidence;
      }
      
      existingCall.phoneNumber = event.call?.phoneNumber || event.phoneNumber || existingCall.phoneNumber;
      existingCall.customerId = event.call?.customerId || event.customerId || existingCall.customerId;
      existingCall.metadata = { ...existingCall.metadata, ...(event.call?.metadata || event.metadata) };
      existingCall.rawEvent = event;
      updateCall(existingCall);
      
      console.log("[VAPI Webhook] call.started: Updated existing call", callId);
      return NextResponse.json({ 
        success: true, 
        message: "Call updated",
        callId: existingCall.id 
      });
    } else {
      // Create new call
      const call = createCall(event);
      const detection = detectBusinessTypeFromCall(event);
      const eventType = event.type || event.event || event.eventType || "call.started";
      
      console.log(
        `[businessType] callId=${callId} event=${eventType} old=router new=${detection.businessType} car=${detection.carHits} rest=${detection.restaurantHits} conf=${detection.confidence}`
      );
      
      call.businessType = detection.businessType;
      call.carHits = detection.carHits;
      call.restaurantHits = detection.restaurantHits;
      call.detectedFrom = detection.detectedFrom;
      call.confidence = detection.confidence;
      updateCall(call);
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
async function handleCallEnded(event: any) {
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
    const existingCall = findCallByCallId(callId);
    
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

    // Update business type if new detection is available (with same rules)
    const detection = detectBusinessTypeFromCall(event);
    const existingType = existingCall.businessType || "router";
    const eventType = event.type || event.event || event.eventType || "call.ended";
    
    if (existingType === "car" || existingType === "restaurant") {
      if (detection.businessType === "router") {
        // Keep existing type
      } else if (detection.businessType !== existingType) {
        // Conflict: car ↔ restaurant - check confidence threshold
        const hitDiff = 
          existingType === "car" 
            ? detection.restaurantHits - detection.carHits
            : detection.carHits - detection.restaurantHits;
        
        if (hitDiff >= 3) {
          // Allow change
          existingCall.businessType = detection.businessType;
          existingCall.carHits = detection.carHits;
          existingCall.restaurantHits = detection.restaurantHits;
          existingCall.detectedFrom = detection.detectedFrom;
          existingCall.confidence = detection.confidence;
        }
        // Otherwise keep existing
      } else {
        // Same type, update metadata
        existingCall.carHits = detection.carHits;
        existingCall.restaurantHits = detection.restaurantHits;
        existingCall.detectedFrom = detection.detectedFrom;
        existingCall.confidence = detection.confidence;
      }
    } else {
      // Existing type is router - allow transition
      existingCall.businessType = detection.businessType;
      existingCall.carHits = detection.carHits;
      existingCall.restaurantHits = detection.restaurantHits;
      existingCall.detectedFrom = detection.detectedFrom;
      existingCall.confidence = detection.confidence;
    }

    updateCall(existingCall);
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
async function handleOrderConfirmed(event: any) {
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
    let existingOrder = findOrderByOrderId(orderId);
    
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
      updateOrder(existingOrder);
      
      console.log("[VAPI Webhook] order.confirmed: Updated existing order", orderId);
      return NextResponse.json({ 
        success: true, 
        message: "Order updated",
        orderId: existingOrder.id 
      });
    } else {
      // Create new order
      const order = createOrder(event);
      
      // Optionally link to call if callId is provided
      if (order.callId) {
        const call = findCallByCallId(order.callId);
        if (call) {
          console.log("[VAPI Webhook] order.confirmed: Linked order to call", call.id);
        }
      }
      
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

