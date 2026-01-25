import Link from "next/link";
import { Call } from "@/lib/vapi-storage";
import { getAdminTokenForOrg } from "@/lib/admin-token";

async function getCall(id: string, orgSlug?: string): Promise<Call | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug);

  if (!baseUrl) {
    console.error("[Dashboard] NEXT_PUBLIC_BASE_URL not set");
    return null;
  }

  if (!adminToken) {
    console.error("[Dashboard] ADMIN_TOKEN not set");
    return null;
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/calls/${id}`);
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
      if (response.status === 404) {
        return null;
      }
      console.error(`[Dashboard] Failed to fetch call: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.call || null;
  } catch (error) {
    console.error("[Dashboard] Error fetching call:", error);
    return null;
  }
}

export default async function CallDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: { orgSlug?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const orgSlug = searchParams?.orgSlug?.trim() || null;
  const call = await getCall(resolvedParams.id, orgSlug || undefined);
  const dashboardHref = orgSlug
    ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard";

  if (!call) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href={dashboardHref}
          className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-4">Call Not Found</h1>
        <p className="text-gray-500">The call with ID {resolvedParams.id} could not be found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href={dashboardHref}
        className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
      >
        ← Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-6">Call Details</h1>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-sm font-medium text-gray-500">Internal ID</label>
            <p className="mt-1 text-sm text-gray-900 font-mono">{call.id}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">VAPI Call ID</label>
            <p className="mt-1 text-sm text-gray-900 font-mono">{call.callId}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Status</label>
            <p className="mt-1">
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
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Business Type</label>
            <p className="mt-1">
              {call.businessType ? (
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded ${
                    call.businessType === "restaurant"
                      ? "bg-green-100 text-green-800"
                      : call.businessType === "car"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {call.businessType}
                </span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Phone Number</label>
            <p className="mt-1 text-sm text-gray-900">
              {call.phoneNumber || <span className="text-gray-400">N/A</span>}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Customer ID</label>
            <p className="mt-1 text-sm text-gray-900">
              {call.customerId || <span className="text-gray-400">N/A</span>}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Created At</label>
            <p className="mt-1 text-sm text-gray-900">
              {call.createdAt
                ? new Date(call.createdAt).toLocaleString()
                : <span className="text-gray-400">N/A</span>}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Started At</label>
            <p className="mt-1 text-sm text-gray-900">
              {call.startedAt
                ? new Date(call.startedAt).toLocaleString()
                : <span className="text-gray-400">N/A</span>}
            </p>
          </div>
        </div>

        {call.metadata && Object.keys(call.metadata).length > 0 && (
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-500">Metadata</label>
            <pre className="mt-1 p-4 bg-gray-50 border border-gray-200 rounded text-xs overflow-x-auto">
              {JSON.stringify(call.metadata, null, 2)}
            </pre>
          </div>
        )}

        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
            Raw Event
          </summary>
          <pre className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded text-xs overflow-x-auto">
            {JSON.stringify(call.rawEvent || {}, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

