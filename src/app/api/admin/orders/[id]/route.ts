import { NextRequest, NextResponse } from "next/server";
import { findOrderByOrderIdByOrganization } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

function normalizePhone(value?: string | null) {
  if (!value) return null;
  return value.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

function isPhoneLike(value?: string | null) {
  if (!value) return false;
  const compact = value.replace(/[^\d]/g, "");
  return compact.length >= 7;
}

function resolveCustomerName(order: any) {
  const rawName = order.customerName || null;
  const rawPhone = order.customerPhone || null;
  const metaName =
    order.metadata?.structuredOutput?.customerName ||
    order.metadata?.customerName ||
    null;

  if (!rawName) return metaName;
  if (!isPhoneLike(rawName)) return rawName;

  const namePhone = normalizePhone(rawName);
  const phone = normalizePhone(rawPhone);
  if (namePhone && phone && namePhone === phone) {
    return metaName || null;
  }

  return metaName || null;
}

function resolveCustomerPhone(order: any) {
  return (
    order.customerPhone ||
    order.metadata?.structuredOutput?.customerPhone ||
    order.metadata?.customerPhone ||
    null
  );
}

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
        customerName: resolveCustomerName(order),
        customerPhone: resolveCustomerPhone(order),
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
