"use server";

import { redirect } from "next/navigation";
import { setSessionOrgCookies } from "@/lib/auth-session";

type PassMap = Record<string, string>;

function parseMap(raw?: string): PassMap {
  if (!raw) return {};
  const entries = raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const m: PassMap = {};
  for (const entry of entries) {
    const [slugRaw, passRaw] = entry.split(/[:=]/).map((p) => p.trim());
    if (!slugRaw || !passRaw) continue;
    m[slugRaw.toLowerCase()] = passRaw;
  }
  return m;
}

export async function loginAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const next = String(formData.get("next") || "/dashboard").trim();

  const map = parseMap(process.env.ADMIN_PASSWORD_BY_ORG);

  if (!orgSlug || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const expected = map[orgSlug];
  if (!expected || expected !== password) {
    redirect(
      `/login?error=invalid&next=${encodeURIComponent(next)}&orgSlug=${encodeURIComponent(
        orgSlug
      )}`
    );
  }

  setSessionOrgCookies(orgSlug);
  redirect(next);
}
