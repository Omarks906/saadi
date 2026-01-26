type OrgPasswordMap = Record<string, string>;

function parseOrgPasswords(raw: string): OrgPasswordMap {
  // Supports JSON: {"chilli":"pass1","beta":"pass2"}
  // Or CSV pairs: chilli:pass1,beta:pass2
  try {
    const parsed = JSON.parse(raw) as OrgPasswordMap;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Fall through to CSV parsing
  }

  const entries = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [slug, ...rest] = pair.split(":");
      return [slug?.trim(), rest.join(":").trim()] as const;
    })
    .filter(([slug, password]) => slug && password);

  return Object.fromEntries(entries);
}

export function resolveExpectedPassword(orgSlug: string | null | undefined) {
  const orgPasswords = process.env.ORG_PASSWORDS;
  if (orgPasswords) {
    const map = parseOrgPasswords(orgPasswords);
    const slug = (orgSlug || "").trim();
    if (!slug) return { expected: null, requiresOrg: true };
    return { expected: map[slug]?.trim() || null, requiresOrg: true };
  }

  const appPw = process.env.APP_PASSWORD?.trim();
  return { expected: appPw || null, requiresOrg: false };
}
