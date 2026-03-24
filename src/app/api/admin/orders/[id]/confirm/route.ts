import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";
import { findOrderByOrderIdByOrganization, updateOrder } from "@/lib/vapi-storage";
import { runPrintPipeline } from "@/lib/printing/print-pipeline";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/orders/[id]/confirm
 *
 * Moves a pending_review order to confirmed and triggers the print pipeline.
 * Intended for staff to review auto-extracted orders before printing.
 *
 * Headers:
 *   x-admin-token  – admin token for the org
 * Query params:
 *   orgSlug        – required to scope the request to an org
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const org = await requireAdminOrg(req);
    const { id: orderId } = await Promise.resolve(params);

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await findOrderByOrderIdByOrganization(orderId, org.id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "pending_review") {
      return NextResponse.json(
        {
          error: `Order is not in pending_review status (current: ${order.status})`,
          currentStatus: order.status,
        },
        { status: 409 }
      );
    }

    order.status = "confirmed";
    order.confirmedAt = new Date().toISOString();
    await updateOrder(order);
    console.log("[confirm] Order", orderId, "confirmed by staff, triggering print");

    void runPrintPipeline(order, { organizationId: org.id }).catch((err) => {
      console.error("[confirm] Print pipeline error for order", orderId, err?.message || err);
    });

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
    });
  } catch (error: any) {
    console.error("[confirm] Error:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
