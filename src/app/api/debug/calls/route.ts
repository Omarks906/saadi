import { NextRequest, NextResponse } from "next/server";
import { listCalls } from "@/lib/vapi-storage";

export const runtime = "nodejs";

/**
 * GET /api/debug/calls
 * List all calls
 */
export async function GET(req: NextRequest) {
  try {
    const calls = listCalls();
    return NextResponse.json({
      success: true,
      count: calls.length,
      calls,
    });
  } catch (error: any) {
    console.error("[Debug] Error listing calls:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to list calls",
      },
      { status: 500 }
    );
  }
}

