import Link from "next/link";
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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const orderId = resolvedParams.id;
  const job = await getFailedPrintJob(orderId);
  const tenantId = getTenantId();

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

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Order Details</h1>
        <Link
          href="/dashboard"
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
