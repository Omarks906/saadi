import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { requirePrintAgentOrgId, toAgentErrorResponse } from "@/lib/printing/agent-auth";

export async function GET(req: NextRequest) {
  try {
    const organizationId = await requirePrintAgentOrgId(req);
    const pool = getPool();

    const result = await pool.query(
      `WITH candidate AS (
         SELECT id
         FROM print_jobs
         WHERE organization_id = $1
           AND status = 'queued'
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE print_jobs pj
       SET status = 'printing',
           claimed_at = NOW(),
           attempts = pj.attempts + 1,
           updated_at = NOW()
       FROM candidate
       WHERE pj.id = candidate.id
       RETURNING pj.id, pj.content`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      printJobId: row.id,
      content: row.content,
    });
  } catch (error) {
    const response = toAgentErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
