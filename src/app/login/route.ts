import { NextResponse } from "next/server";
import { resolveExpectedPassword } from "@/lib/auth";

function setAuthCookie(response: NextResponse) {
  response.cookies.set("so_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  const next = String(form?.get("next") || "/");
  const orgSlug = String(form?.get("orgSlug") || "");
  const { expected, requiresOrg } = resolveExpectedPassword(orgSlug);
  const source = process.env.ORG_PASSWORDS ? "org" : "env";
  const hasExpected = Boolean(expected);
  const matches = Boolean(expected && password === expected);

  console.log("[auth] login attempt", {
    orgSlug,
    source,
    hasExpected,
    requiresOrg,
    matches,
    hasNext: Boolean(next),
  });

  if (!expected || !matches) {
    console.log("[auth] invalid login -> redirect", {
      orgSlug,
      source,
      hasExpected,
      requiresOrg,
    });
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "invalid");
    if (next) redirectUrl.searchParams.set("next", next);
    if (orgSlug || requiresOrg) redirectUrl.searchParams.set("orgSlug", orgSlug);
    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = new URL(next, request.url);
  const response = NextResponse.redirect(redirectUrl);
  setAuthCookie(response);
  return response;
}
