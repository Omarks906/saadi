import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getPrintJobById, markPrintJobRetrying } from "@/lib/printing/print-jobs";
import { findOrderByOrderId } from "@/lib/vapi-storage";
import { runPrintPipeline } from "@/lib/printing/print-pipeline";

export const runtime = "nodejs";

/**
 * POST /api/admin/print-jobs/:id/retry
 * Retry a failed print job for the tenant
 *
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const adminToken = req.headers.get("x-admin-token");
    const requiredToken = process.env.ADMIN_TOKEN;

    if (!requiredToken) {
      console.error("[Admin] ADMIN_TOKEN environment variable not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (!adminToken || adminToken !== requiredToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const jobId = resolvedParams.id;
    const organizationId = getTenantId();

    const job = await getPrintJobById({ organizationId, id: jobId });
    if (!job) {
      return NextResponse.json({ error: "Print job not found" }, { status: 404 });
    }

    if (job.status !== "failed") {
      return NextResponse.json(
        { error: "Only failed print jobs can be retried" },
        { status: 409 }
      );
    }

    const order = await findOrderByOrderId(job.orderId);
    if (!order) {
      return NextResponse.json(
        { error: "Order not found for print job" },
        { status: 404 }
      );
    }

    const updated = await markPrintJobRetrying({ organizationId, id: jobId });
    if (!updated) {
      return NextResponse.json(
        { error: "Print job could not be retried" },
        { status: 409 }
      );
    }

    void runPrintPipeline(order, { allowRetrying: true }).catch((error) => {
      console.error(
        JSON.stringify({
          event: "print_retry_exception",
          order_id: order.orderId,
          organization_id: order.tenantId,
          error: error?.message || String(error),
        })
      );
    });

    return NextResponse.json({ ok: true, jobId: updated.id, status: "retrying" });
  } catch (error: any) {
    console.error("[Admin] Error retrying print job:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
