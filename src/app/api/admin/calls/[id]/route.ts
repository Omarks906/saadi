import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import { Call } from "@/lib/vapi-storage";

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

    // Construct file path
    const filePath = path.join(DATA_DIR, `call-${callId}.json`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Read and parse the call file
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const call = JSON.parse(fileContent) as Call;

      // Validate it's a call object
      if (!call || typeof call !== "object" || !call.callId) {
        return NextResponse.json(
          { error: "Invalid call data" },
          { status: 500 }
        );
      }

      return NextResponse.json({ call });
    } catch (error) {
      console.error(`[Admin] Error reading call file ${callId}:`, error);
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

