import { NextRequest, NextResponse } from "next/server";
import { createCall, findCallByCallId, updateCall, extractAssistantId } from "@/lib/vapi-storage";
import { createOrder, findOrderByOrderId, updateOrder } from "@/lib/vapi-storage";
import { getBusinessTypeFromAssistantId } from "@/lib/vapi-assistant-map";
import { detectBusinessTypeFromCall } from "@/lib/business-type-detector";

export const runtime = "nodejs";

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
    const eventType = body.type || body.event || body.eventType;

    console.log("[VAPI Webhook] Received event:", eventType, {
      timestamp: new Date().toISOString(),
      body: JSON.stringify(body, null, 2),
    });

    // Handle call.started event
    if (eventType === "call.started" || body.event === "call.started") {
      return handleCallStarted(body);
    }

    // Handle order.confirmed event
    if (eventType === "order.confirmed" || body.event === "order.confirmed") {
      return handleOrderConfirmed(body);
    }

    // Unknown event type
    console.warn("[VAPI Webhook] Unknown event type:", eventType);
    return NextResponse.json(
      { 
        success: false, 
        error: `Unknown event type: ${eventType}`,
        received: eventType 
      },
      { status: 400 }
    );
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
          console.warn(
            `[businessType] conflict callId=${callId} old=${existingType} new=${detection.businessType} car=${detection.carHits} rest=${detection.restaurantHits}`
          );
          // Keep existing type
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
    supportedEvents: ["call.started", "order.confirmed"],
    timestamp: new Date().toISOString()
  });
}

