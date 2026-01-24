import { NextRequest } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";

export type OrgContext = {
  id: string;
  slug: string;
};

function getExplicitOrgId(req: NextRequest): string | null {
  return (
    req.nextUrl.searchParams.get("orgId") ||
    req.headers.get("x-org-id")
  );
}

function getExplicitOrgSlug(req: NextRequest): string | null {
  return (
    req.nextUrl.searchParams.get("orgSlug") ||
    req.headers.get("x-org-slug")
  );
}

async function loadOrgById(id: string): Promise<OrgContext | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, slug FROM organizations WHERE id = $1 LIMIT 1",
    [id]
  );
  if (result.rows.length === 0) return null;
  return { id: result.rows[0].id, slug: result.rows[0].slug };
}

async function loadOrgBySlug(slug: string): Promise<OrgContext | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, slug FROM organizations WHERE slug = $1 LIMIT 1",
    [slug]
  );
  if (result.rows.length === 0) return null;
  return { id: result.rows[0].id, slug: result.rows[0].slug };
}

async function loadFirstOrg(): Promise<OrgContext | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, slug FROM organizations ORDER BY created_at ASC LIMIT 1"
  );
  if (result.rows.length === 0) return null;
  return { id: result.rows[0].id, slug: result.rows[0].slug };
}

export async function resolveOrgContext(req: NextRequest): Promise<OrgContext> {
  await initDatabase();

  const explicitOrgId = getExplicitOrgId(req);
  if (explicitOrgId) {
    const org = await loadOrgById(explicitOrgId);
    if (!org) {
      throw new Error(`Organization not found for orgId ${explicitOrgId}`);
    }
    console.log(`[org] resolved slug=${org.slug} id=${org.id}`);
    return org;
  }

  const explicitSlug = getExplicitOrgSlug(req);
  if (explicitSlug) {
    const org = await loadOrgBySlug(explicitSlug);
    if (!org) {
      throw new Error(`Organization not found for orgSlug ${explicitSlug}`);
    }
    console.log(`[org] resolved slug=${org.slug} id=${org.id}`);
    return org;
  }

  const defaultSlug = process.env.DEFAULT_ORG_SLUG;
  if (defaultSlug) {
    const org = await loadOrgBySlug(defaultSlug);
    if (!org) {
      throw new Error(`Organization not found for DEFAULT_ORG_SLUG ${defaultSlug}`);
    }
    console.log(`[org] resolved slug=${org.slug} id=${org.id}`);
    return org;
  }

  const firstOrg = await loadFirstOrg();
  if (!firstOrg) {
    throw new Error("No organizations found in database");
  }
  console.log(`[org] resolved slug=${firstOrg.slug} id=${firstOrg.id}`);
  return firstOrg;
}
