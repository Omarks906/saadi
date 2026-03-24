import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";
import {
  findCallByCallIdByOrganization,
  findOrderByOrderIdByOrganization,
  createOrder,
  updateOrder,
  type FulfillmentType,
} from "@/lib/vapi-storage";
import { extractOrderFromTranscript } from "@/lib/order-extract";
import { runPrintPipeline } from "@/lib/printing/print-pipeline";

export const runtime = "nodejs";

/**
 * POST /api/admin/orders/reprocess/[callId]
 *
 * Re-processes a call's transcript to create or update its order, then
 * triggers the print pipeline.  Marks the resulting order as post_processed.
 *
 * Headers:
 *   x-admin-token  – admin token for the org
 * Query params:
 *   orgSlug        – required to scope the request to an org
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> | { callId: string } }
) {
  try {
    const org = await requireAdminOrg(req);
    const { callId } = await Promise.resolve(params);

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    // 1. Fetch the call record (includes recording_url and transcript)
    const call = await findCallByCallIdByOrganization(callId, org.id);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // 2. Require a transcript to work with
    if (!call.transcript) {
      return NextResponse.json(
        { error: "No transcript available for this call" },
        { status: 422 }
      );
    }

    // 3. Extract order data from the transcript
    const extracted = extractOrderFromTranscript(call.transcript);

    if (!extracted.items || extracted.items.length === 0) {
      return NextResponse.json(
        { error: "Could not extract any items from the transcript", transcript: call.transcript },
        { status: 422 }
      );
    }

    // 4. Map extracted items to the Order items shape
    const orderItems = extracted.items.map((item) => ({
      name: item.name,
      quantity: item.qty,
      price: item.price,
      description: [
        item.size,
        item.glutenFree ? "gluten-free" : null,
        item.mozzarella ? "mozzarella" : null,
        item.notes,
      ]
        .filter(Boolean)
        .join(", ") || undefined,
    }));

    const orderId = callId; // use callId as the order identifier (same pattern as webhook)
    const now = new Date().toISOString();

    // 5. Create or update the order
    let order = await findOrderByOrderIdByOrganization(orderId, org.id);

    if (order) {
      order.status = "confirmed";
      order.confirmedAt = now;
      order.items = orderItems;
      order.fulfillmentType = (extracted.fulfillment as FulfillmentType) || order.fulfillmentType;
      order.totalAmount = extracted.estimatedTotal ?? order.totalAmount;
      order.postProcessed = true;
      await updateOrder(order);
      console.log("[reprocess] Updated existing order", orderId, "for call", callId);
    } else {
      order = await createOrder(
        {
          order: {
            id: orderId,
            callId,
            items: orderItems,
            fulfillmentType: extracted.fulfillment,
            totalAmount: extracted.estimatedTotal,
          },
          confirmedAt: now,
        },
        { organizationId: org.id }
      );
      order.callId = callId;
      order.postProcessed = true;
      order.fulfillmentType = (extracted.fulfillment as FulfillmentType) || undefined;
      order.totalAmount = extracted.estimatedTotal ?? order.totalAmount;
      await updateOrder(order);
      console.log("[reprocess] Created new order", order.id, "for call", callId);
    }

    // 6. Trigger the print pipeline
    void runPrintPipeline(order, { organizationId: org.id }).catch((err) => {
      console.error("[reprocess] Print pipeline error for order", orderId, err?.message || err);
    });

    // 7. Return the processed order
    return NextResponse.json({
      success: true,
      order: {
        id: order.orderId,
        callId: order.callId,
        status: order.status,
        fulfillmentType: order.fulfillmentType,
        items: order.items,
        totalAmount: order.totalAmount,
        postProcessed: order.postProcessed,
        confirmedAt: order.confirmedAt,
        createdAt: order.createdAt,
      },
      extracted: {
        itemCount: extracted.items.length,
        fulfillment: extracted.fulfillment,
        confidence: extracted.confidence,
        estimatedTotal: extracted.estimatedTotal,
      },
    });
  } catch (error: any) {
    console.error("[reprocess] Error:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
