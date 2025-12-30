import { NextRequest, NextResponse } from "next/server";

export function requireAuth(req: NextRequest) {
  const authed = req.cookies.get("so_auth")?.value === "1";
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

