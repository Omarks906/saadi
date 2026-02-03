import Link from "next/link";
import { AnalyticsNavButton } from "@/app/components/AnalyticsNavButton";
import { Call } from "@/lib/vapi-storage";
import { getAdminTokenForOrg } from "@/lib/admin-token";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";
import { isCurrentlyOpen, getTodaysHours, getEstimatedPrepTime } from "@/lib/chilli/config";

export const dynamic = "force-dynamic";

async function getCalls(orgSlug?: string): Promise<Call[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug || undefined);

  if (!baseUrl) {
    console.error("[Dashboard] NEXT_PUBLIC_BASE_URL not set");
    return [];
  }

  if (!adminToken) {
    console.error("[Dashboard] ADMIN_TOKEN not set");
    return [];
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/calls`);
    url.searchParams.set("limit", "50");
    if (orgSlug) {
      url.searchParams.set("orgSlug", orgSlug);
    }
    const response = await fetch(url.toString(), {
      headers: {
        "x-admin-token": adminToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[Dashboard] Failed to fetch calls: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.calls || [];
  } catch (error) {
    console.error("[Dashboard] Error fetching calls:", error);
    return [];
  }
}

async function getFailedPrintJobsCount(orgSlug?: string): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug || undefined);

  if (!baseUrl || !adminToken) {
    return 0;
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/print-jobs`);
    url.searchParams.set("status", "failed");
    if (orgSlug) {
      url.searchParams.set("orgSlug", orgSlug);
    }
    const response = await fetch(url.toString(), {
      headers: {
        "x-admin-token": adminToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[Dashboard] Failed to fetch print jobs: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    return Number(data.count) || 0;
  } catch (error) {
    console.error("[Dashboard] Error fetching print jobs:", error);
    return 0;
  }
}

type ChilliOrder = {
  id: string;
  createdAt: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fulfillmentType?: string | null;
  address?: string | null;
  items?: Array<{ name: string; quantity: number; price?: number; description?: string }>;
  total?: number | null;
  notes?: string;
};

async function getOrders(orgSlug?: string): Promise<ChilliOrder[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug || undefined);

  if (!baseUrl || !adminToken || !orgSlug) {
    return [];
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/orders`);
    url.searchParams.set("limit", "500");
    url.searchParams.set("orgSlug", orgSlug);
    const response = await fetch(url.toString(), {
      headers: {
        "x-admin-token": adminToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[Dashboard] Failed to fetch orders: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    console.error("[Dashboard] Error fetching orders:", error);
    return [];
  }
}

type OrderStats = {
  total: number;
  byStatus: Record<string, number>;
  totalRevenue: number;
  averageOrderValue: number;
  activeOrders: number;
};

async function getOrderStats(orgSlug?: string): Promise<OrderStats | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug || undefined);

  if (!baseUrl || !adminToken || !orgSlug) {
    return null;
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/stats`);
    url.searchParams.set("period", "today");
    url.searchParams.set("orgSlug", orgSlug);
    const response = await fetch(url.toString(), {
      headers: {
        "x-admin-token": adminToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.stats || null;
  } catch {
    return null;
  }
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return d >= start && d < end;
}

function isTransfer(call: Call): boolean {
  const meta = call.metadata || {};
  const raw = call.rawEvent || {};
  return Boolean(
    meta.transfer ||
      meta.transferred ||
      meta.forwarded ||
      meta.forwardedTo ||
      raw.transfer ||
      raw.transferred ||
      raw.forwarded ||
      raw.forwardedTo
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { orgSlug?: string };
}) {
  const orgSlug =
    searchParams?.orgSlug?.trim() ||
    (await getSessionOrgSlugFromCookies()) ||
    null;
  const isChilli = orgSlug === "chilli";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = process.env.ADMIN_TOKEN;
  const calls = await getCalls(orgSlug || undefined);
  const orders = isChilli ? await getOrders(orgSlug || undefined) : [];
  const failedPrintJobs = await getFailedPrintJobsCount(orgSlug || undefined);
  const analyticsHref = orgSlug
    ? `/dashboard/analytics?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard/analytics";
  const ordersHref = orgSlug
    ? `/dashboard/orders?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard/orders";

  // Show configuration errors if env vars are missing
  const hasConfigError = !baseUrl || !adminToken;

  if (isChilli) {
    const callsToday = calls.filter((call) => isToday(call.createdAt));
    const ordersToday = orders.filter((order) => isToday(order.createdAt));
    const transfersToday = callsToday.filter(isTransfer).length;
    const recentCalls = calls.slice(0, 20);
    const recentOrders = orders.slice(0, 20);
    const stats = await getOrderStats(orgSlug || undefined);

    // Restaurant status
    const isOpen = isCurrentlyOpen();
    const todaysHours = getTodaysHours();
    const prepTime = getEstimatedPrepTime();

    // Active orders (not completed or cancelled)
    const activeOrders = ordersToday.filter(
      (o) => !["completed", "cancelled"].includes(o.status)
    );

    const menuHref = orgSlug
      ? `/dashboard/menu?orgSlug=${encodeURIComponent(orgSlug)}`
      : "/dashboard/menu";

    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Chilli Dashboard</h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    isOpen ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-gray-600">
                  {isOpen ? "Open" : "Closed"}
                </span>
              </div>
              {todaysHours && !todaysHours.closed && (
                <span className="text-sm text-gray-400">
                  {todaysHours.open} - {todaysHours.close}
                </span>
              )}
              <span className="text-sm text-gray-400">|</span>
              <span className="text-sm text-gray-500">
                Est. prep: {prepTime} min
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={menuHref}
              prefetch={false}
              className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              View Menu
            </Link>
            <Link
              href={ordersHref}
              prefetch={false}
              className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Kitchen Orders
            </Link>
            <AnalyticsNavButton
              href={analyticsHref}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              View Analytics
            </AnalyticsNavButton>
            <Link
              href="/logout"
              prefetch={false}
              className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Logout
            </Link>
          </div>
        </div>

        {hasConfigError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              Configuration Error
            </h2>
            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
              {!baseUrl && (
                <li>NEXT_PUBLIC_BASE_URL is not set in Railway environment variables</li>
              )}
              {!adminToken && (
                <li>
                  {process.env.ADMIN_TOKEN_BY_ORG
                    ? "ADMIN_TOKEN_BY_ORG is missing this org or orgSlug is not set"
                    : "ADMIN_TOKEN is not set in Railway environment variables"}
                </li>
              )}
            </ul>
            <p className="mt-3 text-sm text-yellow-700">
              Please set these in Railway Dashboard → Your Service → Variables tab
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Calls Today
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {callsToday.length}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Orders Today
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {ordersToday.length}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Active Orders
            </p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {activeOrders.length}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Revenue Today
            </p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {stats ? `${stats.totalRevenue.toFixed(0)} kr` : "—"}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Transfers
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {transfersToday}
            </p>
          </div>
        </div>

        {/* Order Status Breakdown */}
        {stats && stats.total > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Order Status Today</h3>
            <div className="flex flex-wrap gap-4">
              {stats.byStatus.confirmed > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-gray-600">
                    {stats.byStatus.confirmed} Confirmed
                  </span>
                </div>
              )}
              {stats.byStatus.preparing > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-600">
                    {stats.byStatus.preparing} Preparing
                  </span>
                </div>
              )}
              {stats.byStatus.ready > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600">
                    {stats.byStatus.ready} Ready
                  </span>
                </div>
              )}
              {stats.byStatus.out_for_delivery > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm text-gray-600">
                    {stats.byStatus.out_for_delivery} Out for Delivery
                  </span>
                </div>
              )}
              {stats.byStatus.completed > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-600">
                    {stats.byStatus.completed} Completed
                  </span>
                </div>
              )}
              {stats.byStatus.cancelled > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600">
                    {stats.byStatus.cancelled} Cancelled
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {failedPrintJobs > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-800">
              Printing issues: {failedPrintJobs} failed jobs
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Live Calls</h2>
              <Link
                href={orgSlug ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}` : "/dashboard"}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View all
              </Link>
            </div>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-gray-500">No calls yet.</p>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <Link
                    key={call.id}
                    href={`/dashboard/calls/${call.id}?orgSlug=${encodeURIComponent(
                      orgSlug || ""
                    )}`}
                    className="block border border-gray-100 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {call.phoneNumber || "Unknown caller"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {call.createdAt
                            ? new Date(call.createdAt).toLocaleTimeString()
                            : "Time unknown"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        {call.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Live Orders</h2>
              <Link
                href={ordersHref}
                prefetch={false}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View kitchen
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${encodeURIComponent(
                      order.id
                    )}?orgSlug=${encodeURIComponent(orgSlug || "")}`}
                    className="block border border-gray-100 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Order {order.id}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.items?.length ? `${order.items.length} items` : "Items pending"}
                          {order.createdAt
                            ? ` · ${new Date(order.createdAt).toLocaleTimeString()}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          {order.status}
                        </span>
                        {order.total !== undefined && order.total !== null && (
                          <p className="text-sm font-semibold text-gray-900">
                            {Number(order.total).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Calls Dashboard</h1>
        <div className="flex items-center gap-3">
          <AnalyticsNavButton
            href={analyticsHref}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            View Analytics
          </AnalyticsNavButton>
          <Link
            href="/logout"
            prefetch={false}
            className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Logout
          </Link>
        </div>
      </div>
      
      {hasConfigError && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Configuration Error</h2>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {!baseUrl && <li>NEXT_PUBLIC_BASE_URL is not set in Railway environment variables</li>}
            {!adminToken && (
              <li>
                {process.env.ADMIN_TOKEN_BY_ORG
                  ? "ADMIN_TOKEN_BY_ORG is missing this org or orgSlug is not set"
                  : "ADMIN_TOKEN is not set in Railway environment variables"}
              </li>
            )}
          </ul>
          <p className="mt-3 text-sm text-yellow-700">
            Please set these in Railway Dashboard → Your Service → Variables tab
          </p>
        </div>
      )}

      {failedPrintJobs > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-semibold text-red-800">
            Printing issues: {failedPrintJobs} failed jobs
          </p>
        </div>
      )}
      
      {calls.length === 0 ? (
        <p className="text-gray-500">No calls found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Call ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Business Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <Link
                      href={`/dashboard/calls/${call.id}`}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {call.id}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.callId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        call.businessType === "restaurant"
                          ? "bg-green-100 text-green-800"
                          : call.businessType === "car"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {call.businessType || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        call.status === "started"
                          ? "bg-green-100 text-green-800"
                          : call.status === "ended"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.phoneNumber || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.durationSeconds !== undefined && call.durationSeconds !== null
                      ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s`
                      : call.status === "ended"
                      ? "N/A"
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.confidence !== undefined && call.confidence !== null ? (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          call.confidence >= 5
                            ? "bg-green-100 text-green-800"
                            : call.confidence >= 3
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {call.confidence}
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {call.createdAt
                      ? new Date(call.createdAt).toLocaleString()
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

