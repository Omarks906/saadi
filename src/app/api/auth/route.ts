import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = body.password;

  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set auth cookie
  const res = NextResponse.json({ ok: true });
  res.cookies.set("so_auth", "1", { httpOnly: false, sameSite: "lax", path: "/" });
  return res;
}

