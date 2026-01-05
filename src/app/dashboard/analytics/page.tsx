import Link from "next/link";

async function getAnalytics() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!baseUrl || !adminToken) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: {
        "x-admin-token": adminToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[Dashboard] Failed to fetch analytics: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[Dashboard] Error fetching analytics:", error);
    return null;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/dashboard"
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
                <code className="bg-yellow-100 px-1 rounded">ADMIN_TOKEN</code> - Admin authentication token
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
      <Link
        href="/dashboard"
        className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
      >
        ← Back to Dashboard
      </Link>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["car", "restaurant", "router"] as const).map((type) => {
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

