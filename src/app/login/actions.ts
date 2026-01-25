"use server";

import { NextResponse } from "next/server";
import { setSessionOrg } from "@/lib/auth-session";

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

export async function loginAction(_: any, formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const next = String(formData.get("next") || "/dashboard").trim();

  const map = parseMap(process.env.ADMIN_PASSWORD_BY_ORG);

  if (!orgSlug || !password) {
    return { ok: false, error: "Missing orgSlug or password" };
  }

  const expected = map[orgSlug];
  if (!expected || expected !== password) {
    return { ok: false, error: "Invalid org or password" };
  }

  const res = NextResponse.redirect(
    new URL(next, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
  );
  setSessionOrg(res, orgSlug);
  return res;
}
