import Link from "next/link";
import { Call } from "@/lib/vapi-storage";

async function getCalls(): Promise<Call[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!baseUrl) {
    console.error("[Dashboard] NEXT_PUBLIC_BASE_URL not set");
    return [];
  }

  if (!adminToken) {
    console.error("[Dashboard] ADMIN_TOKEN not set");
    return [];
  }

  try {
    const response = await fetch(`${baseUrl}/api/admin/calls?limit=50`, {
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

export default async function DashboardPage() {
  const calls = await getCalls();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Calls Dashboard</h1>
      
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

