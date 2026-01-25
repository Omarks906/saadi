type TokenMap = Record<string, string>;

function parseTokenMap(raw?: string): TokenMap {
  if (!raw) return {};
  const entries = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  const mapping: TokenMap = {};
  for (const entry of entries) {
    const [slugRaw, tokenRaw] = entry.split(/[:=]/).map((part) => part.trim());
    if (!slugRaw || !tokenRaw) continue;
    mapping[slugRaw.toLowerCase()] = tokenRaw;
  }
  return mapping;
}

export function getAdminTokenForOrg(orgSlug?: string): string | null {
  const tokenMapRaw = process.env.ADMIN_TOKEN_BY_ORG;
  if (tokenMapRaw) {
    if (!orgSlug) return null;
    const tokenMap = parseTokenMap(tokenMapRaw);
    return tokenMap[orgSlug.toLowerCase()] || null;
  }

  return process.env.ADMIN_TOKEN || null;
}
