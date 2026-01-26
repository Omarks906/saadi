import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool, initDatabase } from "@/lib/db/connection";

function getAdminToken(req: NextRequest): string | null {
  const header = req.headers.get("x-admin-token");
  if (header) return header;
  return null;
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.ADMIN_RESET_TOKEN;
  const providedToken = getAdminToken(req);
  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const orgSlug = String(body?.orgSlug || "")
    .trim()
    .toLowerCase();
  const newPassword = String(body?.newPassword || body?.password || "").trim();

  if (!orgSlug || !newPassword) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await initDatabase();
  const pool = getPool();
  const hash = await bcrypt.hash(newPassword, 10);

  const result = await pool.query(
    "UPDATE organizations SET password_hash = $1 WHERE slug = $2 RETURNING id",
    [hash, orgSlug]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "org_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, orgSlug });
}
