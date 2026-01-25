import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth-session";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  clearSession(res);
  res.cookies.set("so_auth", "", { path: "/", maxAge: 0 });
  return res;
}
