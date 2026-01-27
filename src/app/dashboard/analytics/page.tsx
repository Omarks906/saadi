import Link from "next/link";
import { getAdminTokenForOrg } from "@/lib/admin-token";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

async function getAnalytics(orgSlug?: string) {
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  let adminToken = getAdminTokenForOrg(orgSlug)?.trim();

  // Validate and clean baseUrl - ensure it's just the URL
  if (baseUrl) {
    // Remove any trailing whitespace or newlines
    baseUrl = baseUrl.split('\n')[0].split(' ')[0].trim();
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '');
  }

  // Validate adminToken - ensure it's just the token
  if (adminToken) {
    // Remove any trailing whitespace or newlines
    adminToken = adminToken.split('\n')[0].split(' ')[0].trim();
  }

  if (!baseUrl || !adminToken) {
    console.error("[Analytics] Missing env vars:", { 
      hasBaseUrl: !!baseUrl, 
      hasAdminToken: !!adminToken,
      baseUrlLength: baseUrl?.length,
      adminTokenLength: adminToken?.length
    });
    return null;
  }

  // Additional validation: ensure baseUrl looks like a URL
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    console.error("[Analytics] Invalid baseUrl format:", baseUrl);
    return { error: `Invalid NEXT_PUBLIC_BASE_URL format. Must start with http:// or https://` };
  }

  try {
    const url = new URL(`${baseUrl}/api/admin/analytics`);
    if (orgSlug) {
      url.searchParams.set("orgSlug", orgSlug);
    }
    console.log("[Analytics] Fetching from:", url);
    
    const response = await fetch(url.toString(), {
      headers: {
        "x-admin-token": adminToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Analytics] Failed to fetch: ${response.status}`, errorText);
      return { error: `API returned ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("[Analytics] Error fetching analytics:", error);
    return { error: error?.message || "Network error" };
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: { orgSlug?: string };
}) {
  const orgSlug =
    searchParams?.orgSlug?.trim() ||
    (await getSessionOrgSlugFromCookies()) ||
    null;
  const analytics = await getAnalytics(orgSlug || undefined);
  const dashboardHref = orgSlug
    ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = getAdminTokenForOrg(orgSlug || undefined);

  // Check if analytics returned an error object
  if (analytics && 'error' in analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href={dashboardHref}
          className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-4">Analytics</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">API Error</h2>
          <p className="text-sm text-red-700">
            Failed to fetch analytics: {analytics.error}
          </p>
          <p className="text-sm text-red-600 mt-2">
            Check server logs for more details.
          </p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href={dashboardHref}
          className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-4">Analytics</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Configuration Error</h2>
          <p className="text-sm text-yellow-700 mb-4">
            Unable to load analytics. Please check the following environment variables in Railway:
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {!baseUrl && (
              <li>
                <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_BASE_URL</code> - Your Railway app URL (e.g., https://saadi-production.up.railway.app)
              </li>
            )}
            {!adminToken && (
              <li>
                <code className="bg-yellow-100 px-1 rounded">
                  {process.env.ADMIN_TOKEN_BY_ORG ? "ADMIN_TOKEN_BY_ORG" : "ADMIN_TOKEN"}
                </code>{" "}
                - Admin authentication token
              </li>
            )}
          </ul>
          <p className="text-sm text-yellow-700 mt-4">
            After setting these variables, redeploy your Railway service for the changes to take effect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={dashboardHref}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          ← Back to Dashboard
        </Link>
        <Link
          href="/logout"
          prefetch={false}
          className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
        >
          Logout
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Assistant Usage Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Calls */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Total Calls</h2>
          <p className="text-3xl font-bold text-gray-900">{analytics.summary.totalCalls}</p>
        </div>

        {/* Calls by Type */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Calls by Type</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Car</span>
              <span className="text-lg font-semibold text-blue-600">{analytics.summary.callsByType.car}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Restaurant</span>
              <span className="text-lg font-semibold text-green-600">{analytics.summary.callsByType.restaurant}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Router</span>
              <span className="text-lg font-semibold text-gray-600">{analytics.summary.callsByType.router}</span>
            </div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Average Duration</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Car</span>
              <span className="text-lg font-semibold">{formatDuration(analytics.duration.average.car)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Restaurant</span>
              <span className="text-lg font-semibold">{formatDuration(analytics.duration.average.restaurant)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Router</span>
              <span className="text-lg font-semibold">{formatDuration(analytics.duration.average.router)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Total Duration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Total Duration by Type</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-sm text-gray-600">Car</span>
            <p className="text-2xl font-bold text-blue-600">{formatDuration(analytics.duration.total.car)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Restaurant</span>
            <p className="text-2xl font-bold text-green-600">{formatDuration(analytics.duration.total.restaurant)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Router</span>
            <p className="text-2xl font-bold text-gray-600">{formatDuration(analytics.duration.total.router)}</p>
          </div>
        </div>
      </div>

      {/* Confidence Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Confidence Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {(["car", "restaurant", "router", "other"] as const).map((type) => {
            const stats = analytics.confidence[type];
            return (
              <div key={type} className="border border-gray-200 rounded p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 capitalize">{type}</h3>
                {stats.count > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Average</span>
                      <span className="font-semibold">{stats.average?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Min</span>
                      <span className="font-semibold">{stats.min}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Max</span>
                      <span className="font-semibold">{stats.max}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Count</span>
                      <span className="font-semibold">{stats.count}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No data</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        Last updated: {new Date(analytics.timestamp).toLocaleString()}
      </div>
    </div>
  );
}

