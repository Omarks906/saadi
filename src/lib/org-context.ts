import { NextRequest } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";
import { getSessionOrgSlug } from "@/lib/auth-session";

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

function normalizePhoneFromCandidate(candidate: any): string | null {
  if (!candidate) return null;
  if (typeof candidate === "string") return normalizePhone(candidate);
  if (typeof candidate === "object") {
    return (
      normalizePhone(candidate.phoneNumber) ||
      normalizePhone(candidate.phone_number) ||
      normalizePhone(candidate.number) ||
      normalizePhone(candidate.phone)
    );
  }
  return null;
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

type PhoneCandidate = { label: string; value: any };

function getPhoneCandidates(event: any): PhoneCandidate[] {
  return [
    { label: "call.phoneNumber", value: event?.call?.phoneNumber },
    { label: "call.to", value: event?.call?.to },
    { label: "call.toPhoneNumber", value: event?.call?.toPhoneNumber },
    { label: "call.to_number", value: event?.call?.to_number },
    { label: "call.toNumber", value: event?.call?.toNumber },
    { label: "call.toPhone", value: event?.call?.toPhone },
    { label: "call.phone_number", value: event?.call?.phone_number },
    { label: "call.from", value: event?.call?.from },
    { label: "call.fromNumber", value: event?.call?.fromNumber },
    { label: "call.fromPhoneNumber", value: event?.call?.fromPhoneNumber },
    { label: "call.from_number", value: event?.call?.from_number },
    { label: "call.assistantPhoneNumber", value: event?.call?.assistantPhoneNumber },
    { label: "call.assistant.phoneNumber", value: event?.call?.assistant?.phoneNumber },
    { label: "assistant.phoneNumber", value: event?.assistant?.phoneNumber },
    { label: "assistant.number", value: event?.assistant?.number },
    { label: "phoneNumber", value: event?.phoneNumber },
    { label: "to", value: event?.to },
    { label: "toPhoneNumber", value: event?.toPhoneNumber },
    { label: "from", value: event?.from },
    { label: "fromNumber", value: event?.fromNumber },
    { label: "fromPhoneNumber", value: event?.fromPhoneNumber },
    { label: "message.phoneNumber", /* inbound or assistant */ value: event?.message?.phoneNumber },
    { label: "message.phone_number", value: event?.message?.phone_number },
    { label: "message.to", value: event?.message?.to },
    { label: "message.toPhoneNumber", value: event?.message?.toPhoneNumber },
    { label: "message.from", value: event?.message?.from },
    { label: "message.fromPhoneNumber", value: event?.message?.fromPhoneNumber },
    { label: "message.assistant.phoneNumber", value: event?.message?.assistant?.phoneNumber },
    { label: "message.assistant.number", value: event?.message?.assistant?.number },
    { label: "message.customer.phoneNumber", value: event?.message?.customer?.phoneNumber },
    { label: "message.customer.phone_number", value: event?.message?.customer?.phone_number },
    { label: "message.customer.number", value: event?.message?.customer?.number },
    { label: "message.customer.phone", value: event?.message?.customer?.phone },
    { label: "message.customer.callerId", value: event?.message?.customer?.callerId },
    { label: "message.customer.caller_id", value: event?.message?.customer?.caller_id },
    { label: "message.call.phoneNumber", value: event?.message?.call?.phoneNumber },
    { label: "message.call.to", value: event?.message?.call?.to },
    { label: "message.call.toPhoneNumber", value: event?.message?.call?.toPhoneNumber },
    { label: "message.call.from", value: event?.message?.call?.from },
    { label: "message.call.customer.phoneNumber", value: event?.message?.call?.customer?.phoneNumber },
    { label: "message.call.customer.number", value: event?.message?.call?.customer?.number },
    { label: "statusUpdate.call.phoneNumber", value: event?.statusUpdate?.call?.phoneNumber },
    { label: "statusUpdate.call.to", value: event?.statusUpdate?.call?.to },
    { label: "statusUpdate.call.from", value: event?.statusUpdate?.call?.from },
    { label: "endOfCallReport.call.phoneNumber", value: event?.endOfCallReport?.call?.phoneNumber },
    { label: "endOfCallReport.call.to", value: event?.endOfCallReport?.call?.to },
    { label: "endOfCallReport.call.from", value: event?.endOfCallReport?.call?.from },
  ];
}

function extractInboundPhone(event: any): string | null {
  const candidates = getPhoneCandidates(event);
  for (const candidate of candidates) {
    const normalized = normalizePhoneFromCandidate(candidate.value);
    if (normalized) return normalized;
  }
  return null;
}

function formatCandidateValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const extracted =
      value.phoneNumber || value.phone_number || value.number || value.phone;
    if (extracted) return String(extracted);
    try {
      const raw = JSON.stringify(value);
      return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function getPhoneCandidateReport(event: any): string[] {
  return getPhoneCandidates(event)
    .map(({ label, value }) => {
      const formatted = formatCandidateValue(value);
      if (!formatted) return null;
      return `${label}=${formatted}`;
    })
    .filter((entry): entry is string => Boolean(entry));
}

function getPhoneDebugReport(event: any): string {
  const parts = [
    `message.phoneNumber=${formatCandidateValue(event?.message?.phoneNumber)}`,
    `message.customer=${formatCandidateValue(event?.message?.customer)}`,
    `message.call=${formatCandidateValue(event?.message?.call)}`,
    `message.assistant=${formatCandidateValue(event?.message?.assistant)}`,
  ];
  return parts.join(" ");
}

export async function resolveOrgContext(
  req: NextRequest,
  options: ResolveOptions = {}
): Promise<OrgContext> {
  await initDatabase();

  const isApiRequest = req.nextUrl.pathname.startsWith("/api/");
  const tryExplicitFirst = isApiRequest;

  const sessionSlug = getSessionOrgSlug(req);
  const explicitOrgId = getExplicitOrgId(req);
  const explicitSlug = getExplicitOrgSlug(req);

  const trySession = async () => {
    if (!sessionSlug) return null;
    const org = await loadOrgBySlug(sessionSlug);
    if (!org) {
      throw new Error(`Organization not found for session orgSlug ${sessionSlug}`);
    }
    if (options.log !== false) logResolvedOrg(org);
    return org;
  };

  const tryExplicit = async () => {
    if (explicitOrgId) {
      const org = await loadOrgById(explicitOrgId);
      if (!org) {
        throw new Error(`Organization not found for orgId ${explicitOrgId}`);
      }
      if (options.log !== false) logResolvedOrg(org);
      return org;
    }

    if (explicitSlug) {
      const org = await loadOrgBySlug(explicitSlug);
      if (!org) {
        throw new Error(`Organization not found for orgSlug ${explicitSlug}`);
      }
      if (options.log !== false) logResolvedOrg(org);
      return org;
    }

    return null;
  };

  if (tryExplicitFirst) {
    const org = await tryExplicit();
    if (org) return org;
    const sessionOrg = await trySession();
    if (sessionOrg) return sessionOrg;
  } else {
    const sessionOrg = await trySession();
    if (sessionOrg) return sessionOrg;
    const org = await tryExplicit();
    if (org) return org;
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

  const candidateReport = getPhoneCandidateReport(event);
  if (candidateReport.length > 0) {
    console.log(`[org] phone candidates ${candidateReport.join(" | ")}`);
  } else {
    console.log("[org] phone candidates none");
  }

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
    const orgSlug = phoneMap[inboundPhone];
    const org = await loadOrgBySlug(orgSlug);
    if (!org) {
      throw new Error(`Organization not found for phone ${inboundPhone}`);
    }
    console.log(
      `[org] resolved slug=${org.slug} id=${org.id} reason=phone phone=${inboundPhone}`
    );
    return org;
  }

  if (inboundPhone) {
    console.log(`[org] no phone map match phone=${inboundPhone}`);
  } else if (candidateReport.length > 0) {
    console.log(
      `[org] no phone extracted candidates=${candidateReport.join(" | ")}`
    );
  } else {
    console.log(`[org] phone debug ${getPhoneDebugReport(event)}`);
    console.log("[org] no phone candidates found in webhook");
  }

  return resolveOrgContext(req);
}
