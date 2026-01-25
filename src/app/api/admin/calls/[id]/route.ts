import { NextRequest, NextResponse } from "next/server";
import { readCallByOrganization } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

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
    // Get call ID from params
    const resolvedParams = await Promise.resolve(params);
    const callId = resolvedParams.id;

    // Read call from database
    try {
      const org = await requireAdminOrg(req);
      const call = await readCallByOrganization(callId, org.id);
      return NextResponse.json({ call });
    } catch (error: any) {
      if (error?.message?.includes("not found")) {
        return NextResponse.json(
          { error: "Call not found" },
          { status: 404 }
        );
      }
      console.error(`[Admin] Error reading call ${callId}:`, error);
      const response = toAdminErrorResponse(error);
      return NextResponse.json(
        { error: response.error },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error("[Admin] Error processing request:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}

