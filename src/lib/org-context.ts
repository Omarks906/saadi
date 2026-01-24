import { NextRequest } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";

export type OrgContext = {
  id: string;
  slug: string;
};

type ResolveOptions = {
  log?: boolean;
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

function logResolvedOrg(org: OrgContext) {
  console.log(`[org] resolved slug=${org.slug} id=${org.id}`);
}

function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized || null;
}

function parsePhoneOrgMap(raw?: string): Record<string, string> {
  if (!raw) return {};
  const entries = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  const mapping: Record<string, string> = {};
  for (const entry of entries) {
    const [phoneRaw, slugRaw] = entry.split(/[:=]/).map((part) => part.trim());
    if (!phoneRaw || !slugRaw) continue;
    const phone = normalizePhone(phoneRaw);
    if (!phone) continue;
    mapping[phone] = slugRaw;
  }
  return mapping;
}

function extractInboundPhone(event: any): string | null {
  const candidates = [
    event?.call?.phoneNumber,
    event?.phoneNumber,
    event?.call?.to,
    event?.call?.toPhoneNumber,
    event?.call?.to_number,
    event?.call?.toNumber,
    event?.call?.phone_number,
    event?.message?.call?.phoneNumber,
    event?.message?.call?.to,
    event?.message?.call?.toPhoneNumber,
    event?.statusUpdate?.call?.phoneNumber,
    event?.statusUpdate?.call?.to,
    event?.endOfCallReport?.call?.phoneNumber,
    event?.endOfCallReport?.call?.to,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePhone(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export async function resolveOrgContext(
  req: NextRequest,
  options: ResolveOptions = {}
): Promise<OrgContext> {
  await initDatabase();

  const explicitOrgId = getExplicitOrgId(req);
  if (explicitOrgId) {
    const org = await loadOrgById(explicitOrgId);
    if (!org) {
      throw new Error(`Organization not found for orgId ${explicitOrgId}`);
    }
    if (options.log !== false) logResolvedOrg(org);
    return org;
  }

  const explicitSlug = getExplicitOrgSlug(req);
  if (explicitSlug) {
    const org = await loadOrgBySlug(explicitSlug);
    if (!org) {
      throw new Error(`Organization not found for orgSlug ${explicitSlug}`);
    }
    if (options.log !== false) logResolvedOrg(org);
    return org;
  }

  const defaultSlug = process.env.DEFAULT_ORG_SLUG;
  if (defaultSlug) {
    const org = await loadOrgBySlug(defaultSlug);
    if (!org) {
      throw new Error(`Organization not found for DEFAULT_ORG_SLUG ${defaultSlug}`);
    }
    if (options.log !== false) logResolvedOrg(org);
    return org;
  }

  const firstOrg = await loadFirstOrg();
  if (!firstOrg) {
    throw new Error("No organizations found in database");
  }
  if (options.log !== false) logResolvedOrg(firstOrg);
  return firstOrg;
}

export async function resolveOrgContextForWebhook(
  req: NextRequest,
  event: any
): Promise<OrgContext> {
  await initDatabase();

  const explicitOrgId = getExplicitOrgId(req);
  if (explicitOrgId) {
    const org = await loadOrgById(explicitOrgId);
    if (!org) {
      throw new Error(`Organization not found for orgId ${explicitOrgId}`);
    }
    logResolvedOrg(org);
    return org;
  }

  const explicitSlug = getExplicitOrgSlug(req);
  if (explicitSlug) {
    const org = await loadOrgBySlug(explicitSlug);
    if (!org) {
      throw new Error(`Organization not found for orgSlug ${explicitSlug}`);
    }
    logResolvedOrg(org);
    return org;
  }

  const phoneMap = parsePhoneOrgMap(process.env.ORG_SLUG_BY_PHONE);
  const inboundPhone = extractInboundPhone(event);
  if (inboundPhone && phoneMap[inboundPhone]) {
    const org = await loadOrgBySlug(phoneMap[inboundPhone]);
    if (!org) {
      throw new Error(`Organization not found for phone ${inboundPhone}`);
    }
    logResolvedOrg(org);
    return org;
  }

  return resolveOrgContext(req);
}
