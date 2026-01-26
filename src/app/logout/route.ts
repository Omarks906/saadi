import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth-session";

export async function GET(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const baseUrl =
    forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/login", baseUrl));
  clearSession(res);
  res.cookies.set("so_auth", "", { path: "/", maxAge: 0 });
  return res;
}
