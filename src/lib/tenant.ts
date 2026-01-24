export function getTenantId(): string {
  const tenantId = process.env.TENANT_ID || process.env.ORG_ID;
  if (!tenantId) {
    throw new Error("TENANT_ID (or ORG_ID) environment variable is not set");
  }
  return tenantId;
}
