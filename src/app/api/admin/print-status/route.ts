import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

const AGENT_OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const QUEUE_DEPTH_ALERT_THRESHOLD = 5;

/**
 * GET /api/admin/print-status
 * Returns a health summary for the print system:
 *   - Queue depth per status
 *   - Agent last seen timestamp
 *   - Warnings if agent is offline or queue is backing up
 */
export async function GET(req: NextRequest) {
  try {
    const org = await requireAdminOrg(req);
    const pool = getPool();

    const [queueResult, agentResult] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM print_jobs
         WHERE organization_id = $1
           AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY status`,
        [org.id]
      ),
      pool.query(
        `SELECT print_agent_last_seen_at FROM organizations WHERE id = $1`,
        [org.id]
      ),
    ]);

    // Build queue depth map
    const queueDepth: Record<string, number> = {
      queued: 0,
      printing: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
    };
    for (const row of queueResult.rows) {
      queueDepth[row.status] = row.count;
    }

    const lastSeenAt: string | null = agentResult.rows[0]?.print_agent_last_seen_at ?? null;
    const agentOfflineSinceMs = lastSeenAt
      ? Date.now() - new Date(lastSeenAt).getTime()
      : null;
    const agentOnline =
      agentOfflineSinceMs !== null && agentOfflineSinceMs < AGENT_OFFLINE_THRESHOLD_MS;

    const warnings: string[] = [];
    if (!lastSeenAt) {
      warnings.push("Agent has never connected — check PRINT_AGENT_TOKEN and APP_BASE_URL on the Windows machine");
    } else if (!agentOnline) {
      const minutesAgo = Math.floor((agentOfflineSinceMs ?? 0) / 60_000);
      warnings.push(`Agent offline — last seen ${minutesAgo} minute(s) ago`);
    }

    const pendingCount = queueDepth.queued + queueDepth.printing + queueDepth.retrying;
    if (pendingCount >= QUEUE_DEPTH_ALERT_THRESHOLD) {
      warnings.push(`Queue backing up — ${pendingCount} job(s) pending (queued/printing/retrying)`);
    }

    if (queueDepth.failed > 0) {
      warnings.push(`${queueDepth.failed} failed print job(s) in the last 24 hours — use admin retry to requeue`);
    }

    return NextResponse.json({
      agentOnline,
      agentLastSeenAt: lastSeenAt,
      queueDepth,
      warnings,
      ok: warnings.length === 0,
    });
  } catch (error) {
    console.error("[Admin] Error fetching print status:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
