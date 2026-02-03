import { NextRequest, NextResponse } from "next/server";
import { getOrderStatsByOrganization } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/stats
 * Get order statistics for the organization
 *
 * Query params:
 * - period: "today" | "week" | "month" | "all" (default: "today")
 *
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get("period") || "today";

    let since: string | undefined;
    const now = new Date();

    switch (period) {
      case "today": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        since = start.toISOString();
        break;
      }
      case "week": {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        since = start.toISOString();
        break;
      }
      case "month": {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        since = start.toISOString();
        break;
      }
      case "all":
      default:
        since = undefined;
    }

    try {
      const org = await requireAdminOrg(req);
      if (org.slug !== "chilli") {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
      }

      const stats = await getOrderStatsByOrganization(org.id, since);

      // Calculate active orders (not completed or cancelled)
      const activeOrders =
        stats.byStatus.confirmed +
        stats.byStatus.preparing +
        stats.byStatus.ready +
        stats.byStatus.out_for_delivery;

      return NextResponse.json({
        period,
        since: since || null,
        stats: {
          ...stats,
          activeOrders,
        },
      });
    } catch (error: any) {
      console.error("[Admin] Error getting stats:", error);
      const response = toAdminErrorResponse(error);
      return NextResponse.json(
        { error: response.error },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error("[Admin] Error processing stats request:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
