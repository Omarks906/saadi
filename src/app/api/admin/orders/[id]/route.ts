import { NextRequest, NextResponse } from "next/server";
import { findOrderByOrderIdByOrganization } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/orders/:id
 * Admin endpoint to get a specific order by orderId
 *
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    try {
      const org = await requireAdminOrg(req);
      if (org.slug !== "chilli") {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
      }
      const order = await findOrderByOrderIdByOrganization(orderId, org.id);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      const responseOrder = {
        id: order.orderId,
        createdAt: order.createdAt,
        confirmedAt: order.confirmedAt,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        fulfillmentType: order.fulfillmentType,
        address: order.customerAddress,
        scheduledFor: order.scheduledFor,
        items: order.items,
        total: order.totalAmount,
        notes: [
          order.specialInstructions?.trim(),
          order.allergies?.trim() ? `Allergies: ${order.allergies.trim()}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
      return NextResponse.json({ order: responseOrder });
    } catch (error: any) {
      console.error(`[Admin] Error reading order ${orderId}:`, error);
      const response = toAdminErrorResponse(error);
      return NextResponse.json(
        { error: response.error },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error("[Admin] Error processing request:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
