import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { requirePrintAgentOrg, toAgentErrorResponse } from "@/lib/printing/agent-auth";

type UpdateBody = {
  jobId?: string;
  status?: "sent" | "failed";
  error?: string;
  providerJobId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const org = await requirePrintAgentOrg(req);
    const body = (await req.json()) as UpdateBody;

    if (!body?.jobId || !body?.status) {
      return NextResponse.json({ error: "jobId and status are required" }, { status: 400 });
    }

    if (body.status !== "sent" && body.status !== "failed") {
      return NextResponse.json({ error: "status must be sent or failed" }, { status: 400 });
    }

    const pool = getPool();
    const existingResult = await pool.query(
      `SELECT id, status FROM print_jobs WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [body.jobId, org.id]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: "print job not found" }, { status: 404 });
    }

    const existing = existingResult.rows[0];

    if (existing.status === "sent" && body.status === "sent") {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    if (body.status === "sent") {
      await pool.query(
        `UPDATE print_jobs
         SET status = 'sent',
             attempts = attempts + 1,
             last_error = NULL,
             provider_job_id = COALESCE($3, provider_job_id),
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [body.jobId, org.id, body.providerJobId || null]
      );
      return NextResponse.json({ ok: true });
    }

    const errorMessage = (body.error || "print_failed").slice(0, 1000);
    await pool.query(
      `UPDATE print_jobs
       SET status = 'failed',
           attempts = attempts + 1,
           last_error = $3,
           provider_job_id = COALESCE($4, provider_job_id),
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [body.jobId, org.id, errorMessage, body.providerJobId || null]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, error: message } = toAgentErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
