import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { requirePrintAgentOrgId, toAgentErrorResponse } from "@/lib/printing/agent-auth";

/**
 * POST /api/print/heartbeat
 * Agent calls this every 30 seconds to signal it is alive.
 * Stores last_seen_at on the organization row so admin tooling can detect offline agents.
 */
export async function POST(req: NextRequest) {
  try {
    const organizationId = await requirePrintAgentOrgId(req);
    const pool = getPool();

    await pool.query(
      `UPDATE organizations SET print_agent_last_seen_at = NOW() WHERE id = $1`,
      [organizationId]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toAgentErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
