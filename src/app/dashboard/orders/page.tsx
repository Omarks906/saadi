import Link from "next/link";
import { getAdminTokenForOrg } from "@/lib/admin-token";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

type ChilliOrder = {
  id: string;
  createdAt: string;
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
      return [];
    }

    const data = await response.json();
    return data.orders || [];
  } catch {
    return [];
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: { orgSlug?: string };
}) {
  const orgSlug =
    searchParams?.orgSlug?.trim() ||
    (await getSessionOrgSlugFromCookies()) ||
    null;
  const isChilli = orgSlug === "chilli";
  const orders = isChilli ? await getOrders(orgSlug || undefined) : [];
  const dashboardHref = orgSlug
    ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard";

  if (!isChilli) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href={dashboardHref}
          className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-2">Kitchen Orders</h1>
        <p className="text-sm text-gray-500">
          The kitchen view is only available for the Chilli pilot org.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kitchen Orders</h1>
          <p className="text-sm text-gray-500">Latest orders for Chilli</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={dashboardHref}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders found.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${encodeURIComponent(
                order.id
              )}?orgSlug=${encodeURIComponent(orgSlug)}`}
              className="block bg-white border-2 border-dashed border-gray-200 rounded-lg p-5 shadow-sm hover:border-gray-300"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    Order {order.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString()
                      : "Time unknown"}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-gray-500">
                  {order.status}
                </span>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                {order.items && order.items.length > 0 ? (
                  order.items.slice(0, 4).map((item, index) => (
                    <p key={`${order.id}-${index}`}>
                      {item.quantity} × {item.name}
                    </p>
                  ))
                ) : (
                  <p className="text-gray-400">Items pending</p>
                )}
                {order.items && order.items.length > 4 && (
                  <p className="text-xs text-gray-500">
                    +{order.items.length - 4} more items
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {order.items?.length ? `${order.items.length} items` : "—"}
                </span>
                {order.total !== undefined && order.total !== null ? (
                  <span className="font-semibold text-gray-900">
                    {Number(order.total).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-400">Total pending</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
