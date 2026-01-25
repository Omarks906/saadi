import { NextRequest, NextResponse } from "next/server";
import { Call, listCallsByOrganization } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/calls
 * Admin endpoint to list calls with filtering and pagination
 * 
 * Query params:
 * - businessType: Filter by business type (optional)
 * - limit: Maximum number of results (default: 50)
 * 
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const businessTypeFilter = searchParams.get("businessType");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 1000) : 50; // Max 1000

    // Get all calls from database
    let calls: Call[];
    try {
      const org = await requireAdminOrg(req);
      calls = await listCallsByOrganization(org.id);
      console.log(`[Admin] Found ${calls.length} calls in database`);
    } catch (error: any) {
      const response = toAdminErrorResponse(error);
      return NextResponse.json(
        {
          error: response.error,
          details: error instanceof Error ? error.message : undefined,
        },
        { status: response.status }
      );
    }

    // Apply businessType filter if specified
    if (businessTypeFilter) {
      calls = calls.filter(call => call.businessType === businessTypeFilter);
    }

    // Apply limit (calls are already sorted by createdAt DESC from listCalls)
    const limitedCalls = calls.slice(0, limit);

    return NextResponse.json({
      calls: limitedCalls,
      total: calls.length,
      returned: limitedCalls.length,
      filters: {
        businessType: businessTypeFilter || null,
        limit,
      },
    });
  } catch (error: any) {
    console.error("[Admin] Error processing request:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}

