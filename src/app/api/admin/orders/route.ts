import { NextRequest, NextResponse } from "next/server";
import { listOrdersByOrganization } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

const ORDER_STATUSES = new Set(["confirmed", "cancelled", "completed"]);

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
 * GET /api/admin/orders
 * Admin endpoint to list orders with filtering and pagination
 *
 * Query params:
 * - status: Filter by status (optional)
 * - limit: Maximum number of results (default: 50)
 * - since: ISO timestamp filter (optional)
 *
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const limitParam = searchParams.get("limit");
    const sinceParam = searchParams.get("since");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;

    const status = statusParam && ORDER_STATUSES.has(statusParam) ? statusParam : undefined;

    let orders = [];
    try {
      const org = await requireAdminOrg(req);
      if (org.slug !== "chilli") {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
      }

      orders = await listOrdersByOrganization(org.id, {
        limit,
        status: status as "confirmed" | "cancelled" | "completed" | undefined,
        since: sinceParam || undefined,
      });
    } catch (error: any) {
      const response = toAdminErrorResponse(error);
      return NextResponse.json(
        { error: response.error, details: error instanceof Error ? error.message : undefined },
        { status: response.status }
      );
    }

    const responseOrders = orders.map((order) => ({
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
    }));

    return NextResponse.json({
      orders: responseOrders,
      total: responseOrders.length,
      returned: responseOrders.length,
      filters: {
        status: status || null,
        limit,
        since: sinceParam || null,
      },
    });
  } catch (error: any) {
    console.error("[Admin] Error processing orders request:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
