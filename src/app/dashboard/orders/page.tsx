import Link from "next/link";
import { getAdminTokenForOrg } from "@/lib/admin-token";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

type OrderStatus =
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

type ChilliOrder = {
  id: string;
  createdAt: string;
  status: OrderStatus;
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

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  confirmed: { label: "New", color: "text-blue-700", bgColor: "bg-blue-100" },
  preparing: { label: "Preparing", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  ready: { label: "Ready", color: "text-green-700", bgColor: "bg-green-100" },
  out_for_delivery: { label: "Delivering", color: "text-purple-700", bgColor: "bg-purple-100" },
  completed: { label: "Done", color: "text-gray-600", bgColor: "bg-gray-100" },
  cancelled: { label: "Cancelled", color: "text-red-700", bgColor: "bg-red-100" },
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
        <>
          {/* Active Orders Section */}
          {orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Active Orders</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {orders
                  .filter((o) => !["completed", "cancelled"].includes(o.status))
                  .map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed;
                    return (
                      <Link
                        key={order.id}
                        href={`/dashboard/orders/${encodeURIComponent(
                          order.id
                        )}?orgSlug=${encodeURIComponent(orgSlug)}`}
                        className="block bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-semibold text-gray-900">
                                #{order.id.slice(-6).toUpperCase()}
                              </p>
                              {order.fulfillmentType && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  order.fulfillmentType === "delivery"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}>
                                  {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {order.createdAt
                                ? new Date(order.createdAt).toLocaleTimeString()
                                : "Time unknown"}
                              {order.customerName && ` - ${order.customerName}`}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-gray-700">
                          {order.items && order.items.length > 0 ? (
                            order.items.slice(0, 4).map((item, index) => (
                              <p key={`${order.id}-${index}`} className="flex justify-between">
                                <span>{item.quantity} x {item.name}</span>
                                {item.price && <span className="text-gray-500">{item.price} kr</span>}
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

                        {order.notes && (
                          <p className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                            {order.notes}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between text-sm border-t pt-3">
                          <span className="text-gray-500">
                            {order.items?.length ? `${order.items.length} items` : "—"}
                          </span>
                          {order.total !== undefined && order.total !== null ? (
                            <span className="font-bold text-gray-900">
                              {Number(order.total).toFixed(0)} kr
                            </span>
                          ) : (
                            <span className="text-gray-400">Total pending</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Completed/Cancelled Orders Section */}
          {orders.filter((o) => ["completed", "cancelled"].includes(o.status)).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-4">Completed Orders</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {orders
                  .filter((o) => ["completed", "cancelled"].includes(o.status))
                  .slice(0, 12)
                  .map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.completed;
                    return (
                      <Link
                        key={order.id}
                        href={`/dashboard/orders/${encodeURIComponent(
                          order.id
                        )}?orgSlug=${encodeURIComponent(orgSlug)}`}
                        className="block bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : "Time unknown"}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            {order.items?.length || 0} items
                          </span>
                          {order.total !== undefined && order.total !== null && (
                            <span className="font-medium text-gray-700">
                              {Number(order.total).toFixed(0)} kr
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
