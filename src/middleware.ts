import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "so_auth";
const ORG_COOKIE_NAME = "so_org";
const ORG_SIG_NAME = "so_sig";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-middleware-prefetch") === "1";
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  const orgCookie = request.cookies.get(ORG_COOKIE_NAME);
  const orgSig = request.cookies.get(ORG_SIG_NAME);
  const hasOrgSession = Boolean(orgCookie?.value && orgSig?.value);
  const isAuthenticated = authCookie?.value === "1" || hasOrgSession;
  const isAdminApi = pathname.startsWith("/api/admin");

  // Allow access to login page
  if (isLoginPage) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    const adminToken = request.headers.get("x-admin-token");
    if (!adminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Check if the route requires authentication
  const isProtectedRoute =
    pathname.startsWith("/new") ||
    pathname.startsWith("/listing") ||
    pathname.startsWith("/dashboard") ||
    pathname === "/";

  if (pathname.startsWith("/dashboard")) {
    console.log("[middleware] dashboard auth check", {
      hasAuth: authCookie?.value === "1",
      hasOrg: Boolean(orgCookie?.value),
      hasSig: Boolean(orgSig?.value),
      isPrefetch,
    });
  }

  // For protected pages, redirect to login if not authenticated
  if (isProtectedRoute && !isAuthenticated) {
    if (isPrefetch) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access login, redirect to home
  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/new/:path*",
    "/listing/:path*",
    "/dashboard/:path*",
    "/api/admin/:path*",
  ],
};

