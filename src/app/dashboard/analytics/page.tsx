import Link from "next/link";
import { getAdminTokenForOrg } from "@/lib/admin-token";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";
import {
  PeakHoursChart,
  DailyTrendChart,
  RevenueTrendChart,
  ConversionFunnel,
  TopItemsChart,
  OrderStatusBreakdown,
} from "@/app/components/AnalyticsCharts";

export const dynamic = "force-dynamic";

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchEnhanced(orgSlug?: string, period = "week") {
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  let adminToken = getAdminTokenForOrg(orgSlug)?.trim();

  if (baseUrl) {
    baseUrl = baseUrl.split("\n")[0].split(" ")[0].trim().replace(/\/$/, "");
  }
  if (adminToken) {
    adminToken = adminToken.split("\n")[0].split(" ")[0].trim();
  }

  if (!baseUrl || !adminToken) return { error: "Missing env vars" };
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://"))
    return { error: "Invalid NEXT_PUBLIC_BASE_URL" };

  try {
    const url = new URL(`${baseUrl}/api/admin/analytics/enhanced`);
    url.searchParams.set("period", period);
    if (orgSlug) url.searchParams.set("orgSlug", orgSlug);

    const res = await fetch(url.toString(), {
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `API ${res.status}: ${text}` };
    }
    return res.json();
  } catch (e: any) {
    return { error: e?.message || "Network error" };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-3xl font-bold ${accent || "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: { orgSlug?: string; period?: string };
}) {
  const orgSlug =
    searchParams?.orgSlug?.trim() ||
    (await getSessionOrgSlugFromCookies()) ||
    null;
  const period = searchParams?.period || "week";

  const data = await fetchEnhanced(orgSlug || undefined, period);

  const dashboardHref = orgSlug
    ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard";

  const makeHref = (p: string) => {
    const params = new URLSearchParams();
    if (orgSlug) params.set("orgSlug", orgSlug);
    params.set("period", p);
    return `/dashboard/analytics?${params.toString()}`;
  };

  const periodLabels: Record<string, string> = {
    today: "Today",
    week: "Last 7 days",
    month: "Last 30 days",
  };

  // ── Error states ────────────────────────────────────────────────────────────

  if (data?.error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <BackNav href={dashboardHref} />
        <h1 className="text-3xl font-bold mb-4">Analytics</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">API Error</h2>
          <p className="text-sm text-red-700">{data.error}</p>
        </div>
      </div>
    );
  }

  const { kpis, funnel, hourlyData, peakHour, dailyTrend, orderStatus, fulfillmentBreakdown, topItems, savings } = data;

  const hasOrders = kpis.totalOrders > 0;
  const isRestaurant = hasOrders;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BackNav href={dashboardHref} />
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {periodLabels[period] || period} · Updated {new Date(data.timestamp).toLocaleTimeString("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSelector current={period} makeHref={makeHref} />
            <Link
              href="/logout"
              prefetch={false}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-white"
            >
              Logout
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Calls" value={kpis.totalCalls} />
          <KpiCard
            label="Total Orders"
            value={kpis.totalOrders}
            accent="text-emerald-600"
          />
          <KpiCard
            label="Revenue"
            value={`${kpis.totalRevenue.toLocaleString()} kr`}
            accent="text-green-600"
          />
          <KpiCard
            label="Conversion"
            value={`${kpis.conversionRate}%`}
            sub="calls → orders"
            accent={kpis.conversionRate >= 50 ? "text-green-600" : kpis.conversionRate >= 25 ? "text-yellow-600" : "text-red-600"}
          />
          <KpiCard
            label="Avg Call"
            value={fmtDuration(kpis.avgCallDuration)}
            sub="duration"
          />
        </div>

        {/* ── Secondary KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Avg Order Value"
            value={hasOrders ? `${kpis.averageOrderValue} kr` : "—"}
          />
          <KpiCard
            label="Completed Orders"
            value={kpis.completedOrders}
            sub={hasOrders ? `${kpis.completionRate}% completion` : undefined}
            accent="text-green-600"
          />
          <KpiCard
            label="Cancelled Orders"
            value={kpis.cancelledOrders}
            accent={kpis.cancelledOrders > 0 ? "text-red-500" : "text-gray-900"}
          />
          <KpiCard
            label="Failed Calls"
            value={kpis.failedCalls}
            accent={kpis.failedCalls > 0 ? "text-orange-500" : "text-gray-900"}
          />
        </div>

        {/* ── Conversion Funnel + Order Status ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>Conversion Funnel</SectionTitle>
            <p className="text-xs text-gray-400 mb-4">
              Calls that resulted in placed and completed orders
            </p>
            <ConversionFunnel funnel={funnel} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>Order Status Breakdown</SectionTitle>
            <p className="text-xs text-gray-400 mb-4">
              Distribution of orders by current status
            </p>
            {hasOrders ? (
              <OrderStatusBreakdown
                orderStatus={orderStatus}
                fulfillmentBreakdown={fulfillmentBreakdown}
              />
            ) : (
              <EmptyState text="No orders in this period" />
            )}
          </div>
        </div>

        {/* ── Peak Hours Heatmap ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-1">
            <SectionTitle>Peak Hours</SectionTitle>
            {peakHour && kpis.totalCalls > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-semibold text-indigo-700">
                Peak: {peakHour.label} ({peakHour.calls} calls)
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Call volume by hour of day (Stockholm time) — consider staffing around peak windows
          </p>
          {kpis.totalCalls > 0 ? (
            <PeakHoursChart data={hourlyData} />
          ) : (
            <EmptyState text="No call data in this period" />
          )}
        </div>

        {/* ── Daily Trend ── */}
        {dailyTrend.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <SectionTitle>Calls & Orders Trend</SectionTitle>
              <p className="text-xs text-gray-400 mb-4">
                Daily volume over the selected period
              </p>
              <DailyTrendChart data={dailyTrend} />
              <div className="flex gap-4 mt-2">
                <Legend color="bg-indigo-500" label="Calls" />
                <Legend color="bg-emerald-500" label="Orders" />
              </div>
            </div>

            {isRestaurant && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <SectionTitle>Revenue Trend</SectionTitle>
                <p className="text-xs text-gray-400 mb-4">
                  Daily revenue (kr) over the selected period
                </p>
                <RevenueTrendChart data={dailyTrend} />
              </div>
            )}
          </div>
        )}

        {/* ── Menu Popularity ── */}
        {topItems.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>Most Ordered Items</SectionTitle>
            <p className="text-xs text-gray-400 mb-4">
              Top menu items by order count — use this to optimise stock and promotions
            </p>
            <TopItemsChart items={topItems} />
          </div>
        )}

        {/* ── AI Savings ── */}
        {savings && kpis.totalCalls > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
            <SectionTitle>AI Cost Savings</SectionTitle>
            <p className="text-xs text-gray-500 mb-4">
              Estimated savings vs. manual phone handling (based on 180 kr/hr staff cost)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Call minutes handled</p>
                <p className="text-2xl font-bold text-teal-700">
                  {savings.totalCallMinutes} min
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Estimated staff cost saved</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {savings.estimatedStaffCostKr.toLocaleString()} kr
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Orders per call</p>
                <p className="text-2xl font-bold text-teal-700">
                  {kpis.totalCalls > 0
                    ? (kpis.totalOrders / kpis.totalCalls).toFixed(2)
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          All times shown in Europe/Stockholm timezone
        </p>
      </div>
    </div>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function BackNav({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm text-blue-600 hover:text-blue-800">
      ← Back to Dashboard
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 mb-0">{children}</h2>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-24 flex items-center justify-center text-sm text-gray-400">
      {text}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function PeriodSelector({
  current,
  makeHref,
}: {
  current: string;
  makeHref: (p: string) => string;
}) {
  const options = [
    { value: "today", label: "Today" },
    { value: "week", label: "7 days" },
    { value: "month", label: "30 days" },
  ];
  return (
    <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={makeHref(o.value)}
          className={`px-3 py-2 ${
            current === o.value
              ? "bg-indigo-600 text-white font-semibold"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
