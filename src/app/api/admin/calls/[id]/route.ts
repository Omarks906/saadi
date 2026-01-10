import { NextRequest, NextResponse } from "next/server";
import { readCall } from "@/lib/vapi-storage";

export const runtime = "nodejs";

/**
 * GET /api/admin/calls/:id
 * Admin endpoint to get a specific call by ID
 * 
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Check authentication
    const adminToken = req.headers.get("x-admin-token");
    const requiredToken = process.env.ADMIN_TOKEN;

    if (!requiredToken) {
      console.error("[Admin] ADMIN_TOKEN environment variable not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (!adminToken || adminToken !== requiredToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get call ID from params
    const resolvedParams = await Promise.resolve(params);
    const callId = resolvedParams.id;

    // Read call from database
    try {
      const call = await readCall(callId);
      return NextResponse.json({ call });
    } catch (error: any) {
      if (error?.message?.includes("not found")) {
        return NextResponse.json(
          { error: "Call not found" },
          { status: 404 }
        );
      }
      console.error(`[Admin] Error reading call ${callId}:`, error);
      return NextResponse.json(
        { error: "Failed to read call data" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Admin] Error processing request:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

