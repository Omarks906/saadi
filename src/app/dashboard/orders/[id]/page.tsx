import Link from "next/link";
import { getAdminTokenForOrg } from "@/lib/admin-token";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";
import { getTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function getFailedPrintJob(orderId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!baseUrl || !adminToken) {
    return null;
  }

  const response = await fetch(`${baseUrl}/api/admin/print-jobs?status=failed`, {
    headers: { "x-admin-token": adminToken },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs.find((job: any) => job.orderId === orderId) || null;
}

async function getFailedPrintJobForOrg(orderId: string, orgSlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug);

  if (!baseUrl || !adminToken) {
    return null;
  }

  const url = new URL(`${baseUrl}/api/admin/print-jobs`);
  url.searchParams.set("status", "failed");
  url.searchParams.set("orgSlug", orgSlug);
  const response = await fetch(url.toString(), {
    headers: { "x-admin-token": adminToken },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs.find((job: any) => job.orderId === orderId) || null;
}

type ChilliOrder = {
  id: string;
  createdAt: string;
  confirmedAt?: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fulfillmentType?: string | null;
  address?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
    description?: string;
    modifiers?: string[];
    toppings?: string[];
    options?: string[];
  }>;
  total?: number | null;
  notes?: string;
};

async function getOrder(orderId: string, orgSlug: string): Promise<ChilliOrder | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug);

  if (!baseUrl || !adminToken) {
    return null;
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/orders/${encodeURIComponent(orderId)}`);
    url.searchParams.set("orgSlug", orgSlug);
    const response = await fetch(url.toString(), {
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.order || null;
  } catch {
    return null;
  }
}

function getFulfillmentLabel(order?: ChilliOrder | null) {
  const value = order?.fulfillmentType?.toLowerCase() || "";
  if (value.includes("deliver")) return "Delivery";
  if (value.includes("pickup")) return "Pickup";
  return order?.fulfillmentType || "—";
}

function getItemModifiers(item: any) {
  const modifiers = []
    .concat(item?.modifiers || [])
    .concat(item?.toppings || [])
    .concat(item?.options || []);
  return modifiers.filter(Boolean);
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: { orgSlug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const orderId = resolvedParams.id;
  const orgSlug =
    searchParams?.orgSlug?.trim() ||
    (await getSessionOrgSlugFromCookies()) ||
    null;
  const isChilli = orgSlug === "chilli";
  const job = isChilli && orgSlug
    ? await getFailedPrintJobForOrg(orderId, orgSlug)
    : await getFailedPrintJob(orderId);
  const tenantId = getTenantId();
  const order = isChilli && orgSlug ? await getOrder(orderId, orgSlug) : null;

  async function retryPrintJob() {
    "use server";
    if (!job) return;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const adminToken = process.env.ADMIN_TOKEN;
    if (!baseUrl || !adminToken) return;
    await fetch(`${baseUrl}/api/admin/print-jobs/${job.id}/retry`, {
      method: "POST",
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    });
  }

  const dashboardHref = orgSlug
    ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard";
  const ordersHref = orgSlug
    ? `/dashboard/orders?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard/orders";

  if (!isChilli) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Order Details</h1>
          <Link
            href={dashboardHref}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Order ID</div>
              <div className="font-mono">{orderId}</div>
            </div>
            <div>
              <div className="text-gray-500">Tenant</div>
              <div className="font-mono">{tenantId}</div>
            </div>
          </div>
        </div>

        {job ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
            <div>
              <div className="text-sm font-semibold text-red-800">Print failed</div>
              <p className="text-sm text-red-700">
                Attempts: {job.attempts} {job.lastError ? `· ${job.lastError}` : ""}
              </p>
            </div>
            <form action={retryPrintJob}>
              <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Retry print
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-sm font-semibold text-green-800">
              Print status OK
            </div>
            <p className="text-sm text-green-700">
              No failed print jobs for this order.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Ticket</h1>
          <p className="text-sm text-gray-500">Chilli kitchen view</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={ordersHref}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Kitchen
          </Link>
          <Link
            href={dashboardHref}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">Order {orderId}</p>
            <p className="text-sm text-gray-500">
              {order?.createdAt
                ? new Date(order.createdAt).toLocaleString()
                : "Time unknown"}
            </p>
          </div>
          <span className="text-xs font-semibold uppercase text-gray-500">
            {order?.status || "unknown"}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase">Customer</p>
            <p className="text-sm text-gray-900">{order?.customerName || "—"}</p>
            <p className="text-sm text-gray-700">{order?.customerPhone || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase">Fulfillment</p>
            <p className="text-sm text-gray-900">{getFulfillmentLabel(order)}</p>
            <p className="text-sm text-gray-700">
              {order?.scheduledFor
                ? new Date(order.scheduledFor).toLocaleString()
                : "ASAP"}
            </p>
            {getFulfillmentLabel(order) === "Delivery" && (
              <p className="text-sm text-gray-700">{order?.address || "—"}</p>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase">Items</p>
          {order && order.items && order.items.length > 0 ? (
            <div className="mt-2 space-y-2 text-sm text-gray-900">
              {order.items.map((item, index) => (
                <div key={`${order.id}-${index}`} className="space-y-1">
                  <div className="flex justify-between">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    {item.price !== undefined && (
                      <span className="text-gray-500">
                        {Number(item.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {(item.description || getItemModifiers(item).length > 0) && (
                    <div className="text-xs text-gray-500">
                      {item.description}
                      {item.description && getItemModifiers(item).length > 0 ? " · " : ""}
                      {getItemModifiers(item).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Items pending</p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase">
              Notes
            </p>
            <p className="text-sm text-gray-900">
              {order?.notes || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase">Allergies</p>
            <p className="text-sm text-gray-900">
              {order?.notes?.includes("Allergies:") ? "See notes" : "—"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
          <span className="text-gray-500">
            {order?.items?.length ? `${order.items.length} items` : "—"}
          </span>
          {order?.total !== undefined && order.total !== null ? (
            <span className="text-lg font-semibold text-gray-900">
              {Number(order.total).toFixed(2)}
            </span>
          ) : (
            <span className="text-gray-400">Total pending</span>
          )}
        </div>
      </div>

      {job ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold text-red-800">Print failed</div>
            <p className="text-sm text-red-700">
              Attempts: {job.attempts} {job.lastError ? `· ${job.lastError}` : ""}
            </p>
          </div>
          <form action={retryPrintJob}>
            <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Retry print
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="text-sm font-semibold text-green-800">
            Print status OK
          </div>
          <p className="text-sm text-green-700">
            No failed print jobs for this order.
          </p>
        </div>
      )}
    </div>
  );
}
