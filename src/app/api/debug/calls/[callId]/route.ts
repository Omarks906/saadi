import { NextRequest, NextResponse } from "next/server";
import { readCall, findCallByCallId } from "@/lib/vapi-storage";

export const runtime = "nodejs";

/**
 * GET /api/debug/calls/:callId
 * Get a specific call by internal ID or VAPI callId
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> | { callId: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const callId = resolvedParams.callId;

    // Try to find by internal ID first
    let call;
    try {
      call = readCall(callId);
    } catch {
      // If not found by internal ID, try to find by VAPI callId
      call = findCallByCallId(callId);
    }

    if (!call) {
      return NextResponse.json(
        {
          success: false,
          error: "Call not found",
          callId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      call,
    });
  } catch (error: any) {
    console.error("[Debug] Error reading call:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to read call",
      },
      { status: 500 }
    );
  }
}

