import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "so_org";
const SIG_NAME = "so_sig";

function secret() {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s) throw new Error("AUTH_SESSION_SECRET is not set");
  return s;
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function getSessionOrgSlug(req: NextRequest): string | null {
  const v = req.cookies.get(COOKIE_NAME)?.value;
  const sig = req.cookies.get(SIG_NAME)?.value;
  if (!v || !sig) return null;
  if (sign(v) !== sig) return null;
  return v;
}

export async function getSessionOrgSlugFromCookies(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE_NAME)?.value;
  const sig = jar.get(SIG_NAME)?.value;
  if (!v || !sig) return null;
  if (sign(v) !== sig) return null;
  return v;
}

export function setSessionOrg(res: NextResponse, orgSlug: string) {
  const v = orgSlug.trim().toLowerCase();
  res.cookies.set(COOKIE_NAME, v, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  res.cookies.set(SIG_NAME, sign(v), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function setSessionOrgCookies(orgSlug: string) {
  const v = orgSlug.trim().toLowerCase();
  const jar = await cookies();
  jar.set(COOKIE_NAME, v, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  jar.set(SIG_NAME, sign(v), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set(SIG_NAME, "", { path: "/", maxAge: 0 });
}
