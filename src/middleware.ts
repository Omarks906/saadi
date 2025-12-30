import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "so_auth";

export function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/login";
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  const isAuthenticated = authCookie?.value === "1";

  // Allow access to login page
  if (isLoginPage) {
    return NextResponse.next();
  }

  // Check if the route requires authentication
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/new") ||
    request.nextUrl.pathname.startsWith("/listing") ||
    request.nextUrl.pathname === "/";

  // For protected pages, redirect to login if not authenticated
  if (isProtectedRoute && !isAuthenticated) {
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
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

