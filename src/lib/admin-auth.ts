import { NextRequest } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";
import type { OrgContext } from "@/lib/org-context";
import { resolveOrgContext } from "@/lib/org-context";

class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type TokenMap = Record<string, string>;

function parseTokenMap(raw?: string): TokenMap {
  if (!raw) return {};
  const entries = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  const mapping: TokenMap = {};
  for (const entry of entries) {
    const [slugRaw, tokenRaw] = entry.split(/[:=]/).map((part) => part.trim());
    if (!slugRaw || !tokenRaw) continue;
    const slug = slugRaw.toLowerCase();
    mapping[slug] = tokenRaw;
  }
  return mapping;
}

function getOrgSlugFromRequest(req: NextRequest): string | null {
  const slug =
    req.nextUrl.searchParams.get("orgSlug") || req.headers.get("x-org-slug");
  return slug ? slug.trim().toLowerCase() : null;
}

async function loadOrgBySlug(slug: string): Promise<OrgContext> {
  await initDatabase();
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, slug FROM organizations WHERE slug = $1 LIMIT 1",
    [slug]
  );
  if (result.rows.length === 0) {
    throw new AdminAuthError(`Organization not found for orgSlug ${slug}`, 404);
  }
  return { id: result.rows[0].id, slug: result.rows[0].slug };
}

export async function requireAdminOrg(req: NextRequest): Promise<OrgContext> {
  const adminToken = req.headers.get("x-admin-token");
  const tokenMapRaw = process.env.ADMIN_TOKEN_BY_ORG;

  if (tokenMapRaw) {
    if (!adminToken) {
      throw new AdminAuthError("Unauthorized", 401);
    }

    const tokenMap = parseTokenMap(tokenMapRaw);
    const explicitSlug = getOrgSlugFromRequest(req);

    if (explicitSlug) {
      const expectedToken = tokenMap[explicitSlug];
      if (!expectedToken || expectedToken !== adminToken) {
        throw new AdminAuthError("Unauthorized", 401);
      }
      return loadOrgBySlug(explicitSlug);
    }

    const matchedSlugs = Object.entries(tokenMap)
      .filter(([, token]) => token === adminToken)
      .map(([slug]) => slug);

    if (matchedSlugs.length === 1) {
      return loadOrgBySlug(matchedSlugs[0]);
    }

    throw new AdminAuthError("Organization required", 400);
  }

  const requiredToken = process.env.ADMIN_TOKEN;
  if (!requiredToken) {
    throw new AdminAuthError("Server configuration error", 500);
  }

  if (!adminToken || adminToken !== requiredToken) {
    throw new AdminAuthError("Unauthorized", 401);
  }

  return resolveOrgContext(req);
}

export function toAdminErrorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return { status: error.status, error: error.message };
  }
  return { status: 500, error: "Internal server error" };
}
