import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool, initDatabase } from "@/lib/db/connection";
import { setSessionOrg } from "@/lib/auth-session";

function buildLoginRedirect(
  requestUrl: string,
  error: "missing" | "invalid" | "unset",
  next: string,
  orgSlug?: string
) {
  const redirectUrl = new URL("/login", requestUrl);
  redirectUrl.searchParams.set("error", error);
  redirectUrl.searchParams.set("next", next);
  if (orgSlug) {
    redirectUrl.searchParams.set("orgSlug", orgSlug);
  }
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const orgSlug = String(form?.get("orgSlug") || "")
    .trim()
    .toLowerCase();
  const password = String(form?.get("password") || "").trim();
  const next = String(form?.get("next") || "/dashboard").trim();

  if (!orgSlug || !password) {
    return buildLoginRedirect(request.url, "missing", next, orgSlug);
  }

  await initDatabase();
  const pool = getPool();
  const orgResult = await pool.query(
    "SELECT id, slug, password_hash FROM organizations WHERE slug = $1 LIMIT 1",
    [orgSlug]
  );

  if (orgResult.rows.length === 0) {
    return buildLoginRedirect(request.url, "invalid", next, orgSlug);
  }

  const passwordHash = orgResult.rows[0]?.password_hash as string | null;
  if (!passwordHash) {
    return buildLoginRedirect(request.url, "unset", next, orgSlug);
  }

  const matches = await bcrypt.compare(password, passwordHash);
  if (!matches) {
    return buildLoginRedirect(request.url, "invalid", next, orgSlug);
  }

  let finalNext = next || "/dashboard";
  if (finalNext.startsWith("/dashboard") && !finalNext.includes("orgSlug=")) {
    const sep = finalNext.includes("?") ? "&" : "?";
    finalNext = `${finalNext}${sep}orgSlug=${encodeURIComponent(orgSlug)}`;
  }

  const response = NextResponse.redirect(new URL(finalNext, request.url));
  response.cookies.set("so_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  setSessionOrg(response, orgSlug);
  return response;
}
