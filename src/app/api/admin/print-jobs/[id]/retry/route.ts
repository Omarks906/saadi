import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPrintJobById } from "@/lib/printing/print-jobs";
import { getPool } from "@/lib/db/connection";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/print-jobs/:id/retry
 * Retry a failed print job for the tenant by creating a fresh queued job.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const jobId = resolvedParams.id;
    const org = await requireAdminOrg(req);
    const organizationId = org.id;

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

    const pool = getPool();
    const newId = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO print_jobs (
        id, organization_id, order_id, call_id, status, attempts, last_error, printer_target, content, created_at, updated_at, claimed_at
      ) VALUES ($1, $2, $3, $4, 'queued', 0, NULL, $5, $6, NOW(), NOW(), NULL)
      RETURNING id, status`,
      [
        newId,
        organizationId,
        job.orderId,
        job.callId || null,
        job.printerTarget || null,
        job.content || `Order #${job.orderId}`,
      ]
    );

    return NextResponse.json({ ok: true, jobId: result.rows[0].id, status: result.rows[0].status });
  } catch (error: unknown) {
    console.error("[Admin] Error retrying print job:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
