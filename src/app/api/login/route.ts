import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool, initDatabase } from "@/lib/db/connection";
import { setSessionOrg } from "@/lib/auth-session";

function getBaseUrl(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase;
  return host ? `${proto}://${host}` : request.url;
}

function buildLoginRedirect(
  request: Request,
  error: "missing" | "invalid" | "unset",
  next: string,
  orgSlug?: string
) {
  const redirectUrl = new URL("/login", getBaseUrl(request));
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
  const rawNext = String(form?.get("next") || "/dashboard").trim();
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  if (!orgSlug || !password) {
    return buildLoginRedirect(request, "missing", next, orgSlug);
  }

  await initDatabase();
  const pool = getPool();
  const orgResult = await pool.query(
    "SELECT id, slug, password_hash FROM organizations WHERE slug = $1 LIMIT 1",
    [orgSlug]
  );

  if (orgResult.rows.length === 0) {
    return buildLoginRedirect(request, "invalid", next, orgSlug);
  }

  const passwordHash = orgResult.rows[0]?.password_hash as string | null;
  if (!passwordHash) {
    return buildLoginRedirect(request, "unset", next, orgSlug);
  }

  const matches = await bcrypt.compare(password, passwordHash);
  if (!matches) {
    return buildLoginRedirect(request, "invalid", next, orgSlug);
  }

  let finalNext = next || "/dashboard";
  if (finalNext.startsWith("/dashboard") && !finalNext.includes("orgSlug=")) {
    const sep = finalNext.includes("?") ? "&" : "?";
    finalNext = `${finalNext}${sep}orgSlug=${encodeURIComponent(orgSlug)}`;
  }

  const redirectUrl = new URL(finalNext, getBaseUrl(request)).toString();
  const response = new NextResponse(
    `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=${redirectUrl}"></head><body>Redirecting...</body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
  response.cookies.set("so_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  setSessionOrg(response, orgSlug);
  return response;
}
