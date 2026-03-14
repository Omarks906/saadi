import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";
import { getPool } from "@/lib/db/connection";

export const runtime = "nodejs";

const TZ = "Europe/Stockholm";

function getStockholmHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour");
  return h ? parseInt(h.value) : 0;
}

function getStockholmDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPeriodSince(period: string): string | undefined {
  const now = new Date();
  switch (period) {
    case "today": {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = fmt.formatToParts(now);
      const p: Record<string, string> = {};
      for (const part of parts) p[part.type] = part.value;
      const msIntoDay =
        (parseInt(p.hour) * 3600 +
          parseInt(p.minute) * 60 +
          parseInt(p.second)) *
        1000;
      return new Date(now.getTime() - msIntoDay).toISOString();
    }
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case "month": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    default:
      return undefined;
  }
}

/**
 * GET /api/admin/analytics/enhanced
 * Enhanced analytics endpoint for restaurant intelligence dashboard
 *
 * Query params:
 *   period: "today" | "week" | "month" (default: "week")
 *   orgSlug: organization slug (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const org = await requireAdminOrg(req);
    const pool = getPool();
    const period = req.nextUrl.searchParams.get("period") || "week";
    const since = getPeriodSince(period);

    const orgId = org.id;
    const sinceParam = since || "1970-01-01T00:00:00.000Z";

    // ── Fetch raw data ────────────────────────────────────────────────────────

    const [callsResult, ordersResult] = await Promise.all([
      pool.query(
        `SELECT id, created_at, status, duration_seconds, phone_number, business_type
         FROM calls
         WHERE organization_id = $1 AND created_at >= $2
         ORDER BY created_at ASC`,
        [orgId, sinceParam]
      ),
      pool.query(
        `SELECT id, call_id, created_at, status, total_amount, items, fulfillment_type
         FROM orders
         WHERE organization_id = $1 AND created_at >= $2
         ORDER BY created_at ASC`,
        [orgId, sinceParam]
      ),
    ]);

    const calls = callsResult.rows;
    const orders = ordersResult.rows;

    // ── KPIs ─────────────────────────────────────────────────────────────────

    const totalCalls = calls.length;
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === "completed").length;
    const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
    const endedCalls = calls.filter((c) => c.status === "ended").length;
    const failedCalls = calls.filter((c) => c.status === "failed").length;

    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

    const revenueOrders = orders.filter(
      (o) => o.status !== "cancelled" && o.total_amount
    );
    const averageOrderValue =
      revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0;

    const durationsWithValue = calls.filter(
      (c) => c.duration_seconds != null && c.duration_seconds > 0
    );
    const avgCallDuration =
      durationsWithValue.length > 0
        ? durationsWithValue.reduce(
            (sum: number, c: any) => sum + c.duration_seconds,
            0
          ) / durationsWithValue.length
        : 0;

    const conversionRate =
      totalCalls > 0 ? (totalOrders / totalCalls) * 100 : 0;
    const completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // ── Conversion Funnel ────────────────────────────────────────────────────

    const callsWithOrderSet = new Set(
      orders.map((o: any) => o.call_id).filter(Boolean)
    );
    const callsWithOrders = calls.filter((c: any) =>
      callsWithOrderSet.has(c.id)
    ).length;

    const funnel = {
      calls: totalCalls,
      callsWithOrders,
      confirmedOrders: totalOrders,
      completedOrders,
    };

    // ── Hourly Distribution ──────────────────────────────────────────────────

    const hourlyMap: Record<
      number,
      { calls: number; orders: number; revenue: number }
    > = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { calls: 0, orders: 0, revenue: 0 };
    }

    for (const c of calls) {
      const h = getStockholmHour(new Date(c.created_at));
      hourlyMap[h].calls += 1;
    }

    for (const o of orders) {
      const h = getStockholmHour(new Date(o.created_at));
      hourlyMap[h].orders += 1;
      hourlyMap[h].revenue += parseFloat(o.total_amount) || 0;
    }

    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      calls: hourlyMap[h].calls,
      orders: hourlyMap[h].orders,
      revenue: Math.round(hourlyMap[h].revenue),
    }));

    // Peak hour (by call volume)
    const peakHour = hourlyData.reduce(
      (best, cur) => (cur.calls > best.calls ? cur : best),
      hourlyData[0]
    );

    // ── Daily Trend ──────────────────────────────────────────────────────────

    const dailyMap: Record<
      string,
      { calls: number; orders: number; revenue: number }
    > = {};

    for (const c of calls) {
      const d = getStockholmDateStr(new Date(c.created_at));
      if (!dailyMap[d]) dailyMap[d] = { calls: 0, orders: 0, revenue: 0 };
      dailyMap[d].calls += 1;
    }

    for (const o of orders) {
      const d = getStockholmDateStr(new Date(o.created_at));
      if (!dailyMap[d]) dailyMap[d] = { calls: 0, orders: 0, revenue: 0 };
      dailyMap[d].orders += 1;
      dailyMap[d].revenue += parseFloat(o.total_amount) || 0;
    }

    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        orders: data.orders,
        revenue: Math.round(data.revenue),
      }));

    // ── Order Status Breakdown ───────────────────────────────────────────────

    const statusMap: Record<string, number> = {
      confirmed: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      if (o.status in statusMap) statusMap[o.status] += 1;
    }

    // ── Fulfillment Breakdown ────────────────────────────────────────────────

    const fulfillmentBreakdown = { delivery: 0, pickup: 0 };
    for (const o of orders) {
      const ft = (o.fulfillment_type || "").toLowerCase();
      if (ft === "delivery") fulfillmentBreakdown.delivery += 1;
      else if (ft === "pickup") fulfillmentBreakdown.pickup += 1;
    }

    // ── Menu Item Popularity ─────────────────────────────────────────────────

    const itemMap: Record<string, { count: number; revenue: number }> = {};
    for (const o of orders) {
      if (!o.items) continue;
      const items = Array.isArray(o.items) ? o.items : [];
      for (const item of items) {
        const name = (item.name || "Unknown").trim();
        if (!itemMap[name]) itemMap[name] = { count: 0, revenue: 0 };
        itemMap[name].count += item.quantity || 1;
        itemMap[name].revenue +=
          (item.price || 0) * (item.quantity || 1);
      }
    }

    const topItems = Object.entries(itemMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Cost Savings (AI vs staff) ───────────────────────────────────────────

    // Estimate: avg staff wage 180 kr/hr, avg 5 min/call handled manually
    const staffCostPerMinute = 180 / 60;
    const totalCallMinutes = durationsWithValue.reduce(
      (sum: number, c: any) => sum + (c.duration_seconds || 0) / 60,
      0
    );
    const estimatedStaffCost = Math.round(
      totalCallMinutes * staffCostPerMinute
    );

    return NextResponse.json({
      period,
      since: sinceParam,
      kpis: {
        totalCalls,
        totalOrders,
        completedOrders,
        cancelledOrders,
        endedCalls,
        failedCalls,
        totalRevenue: Math.round(totalRevenue),
        averageOrderValue: Math.round(averageOrderValue),
        avgCallDuration: Math.round(avgCallDuration),
        conversionRate: Math.round(conversionRate * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
      },
      funnel,
      hourlyData,
      peakHour,
      dailyTrend,
      orderStatus: statusMap,
      fulfillmentBreakdown,
      topItems,
      savings: {
        estimatedStaffCostKr: estimatedStaffCost,
        totalCallMinutes: Math.round(totalCallMinutes),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Admin] Error in enhanced analytics:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
