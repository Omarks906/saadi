import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { requirePrintAgentOrgId, toAgentErrorResponse } from "@/lib/printing/agent-auth";

type UpdateBody = {
  printJobId?: string;
  status?: "sent" | "failed";
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const organizationId = await requirePrintAgentOrgId(req);
    const body = (await req.json()) as UpdateBody;

    if (!body.printJobId || !body.status) {
      return NextResponse.json({ error: "printJobId and status are required" }, { status: 400 });
    }

    if (body.status !== "sent" && body.status !== "failed") {
      return NextResponse.json({ error: "status must be sent or failed" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
      `UPDATE print_jobs
       SET status = $3,
           last_error = CASE WHEN $3 = 'failed' THEN LEFT(COALESCE($4, 'print_failed'), 1000) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [body.printJobId, organizationId, body.status, body.error || null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "print job not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toAgentErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
