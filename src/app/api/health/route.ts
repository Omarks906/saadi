import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db/connection";

export const runtime = "nodejs";

/**
 * GET /api/health
 * Triggers DB init and returns basic status.
 */
export async function GET() {
  try {
    await initDatabase();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Health] DB init failed:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "DB init failed" },
      { status: 500 }
    );
  }
}
