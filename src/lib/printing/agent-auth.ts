import { NextRequest } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";

export type AgentOrgContext = {
  id: string;
  slug: string;
};

export class AgentAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requirePrintAgentOrg(req: NextRequest): Promise<AgentOrgContext> {
  const configuredToken = process.env.PRINT_AGENT_TOKEN;
  if (!configuredToken) {
    throw new AgentAuthError("Server configuration error", 500);
  }

  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${configuredToken}`;
  if (authHeader !== expected) {
    throw new AgentAuthError("Unauthorized", 401);
  }

  await initDatabase();
  const pool = getPool();

  const orgId = process.env.PRINT_AGENT_ORG_ID?.trim();
  const orgSlug = process.env.PRINT_AGENT_ORG_SLUG?.trim().toLowerCase();

  if (orgId) {
    const result = await pool.query(
      "SELECT id, slug FROM organizations WHERE id = $1 LIMIT 1",
      [orgId]
    );
    if (result.rows.length === 0) {
      throw new AgentAuthError("Configured PRINT_AGENT_ORG_ID not found", 500);
    }
    return { id: result.rows[0].id, slug: result.rows[0].slug };
  }

  if (orgSlug) {
    const result = await pool.query(
      "SELECT id, slug FROM organizations WHERE slug = $1 LIMIT 1",
      [orgSlug]
    );
    if (result.rows.length === 0) {
      throw new AgentAuthError("Configured PRINT_AGENT_ORG_SLUG not found", 500);
    }
    return { id: result.rows[0].id, slug: result.rows[0].slug };
  }

  throw new AgentAuthError(
    "Server configuration error: set PRINT_AGENT_ORG_ID or PRINT_AGENT_ORG_SLUG",
    500
  );
}

export function toAgentErrorResponse(error: unknown): { status: number; error: string } {
  if (error instanceof AgentAuthError) {
    return { status: error.status, error: error.message };
  }
  return { status: 500, error: "Internal server error" };
}
