import { NextRequest } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";

export class AgentAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requirePrintAgentOrgId(req: NextRequest): Promise<string> {
  const configuredToken = process.env.PRINT_AGENT_TOKEN;
  const authHeader = req.headers.get("authorization") || "";

  if (!configuredToken || authHeader !== `Bearer ${configuredToken}`) {
    throw new AgentAuthError("Unauthorized", 401);
  }

  const pilotSlug = (process.env.PILOT_ORG_SLUG || "chilli").trim().toLowerCase();

  await initDatabase();
  const pool = getPool();
  const result = await pool.query(
    "SELECT id FROM organizations WHERE slug = $1 LIMIT 1",
    [pilotSlug]
  );

  if (result.rows.length === 0) {
    throw new AgentAuthError(`Pilot org not found for slug ${pilotSlug}`, 500);
  }

  return result.rows[0].id;
}

export function toAgentErrorResponse(error: unknown): { status: number; error: string } {
  if (error instanceof AgentAuthError) {
    return { status: error.status, error: error.message };
  }
  return { status: 500, error: "Internal server error" };
}
