import { NextRequest, NextResponse } from "next/server";
import { Call, listCalls } from "@/lib/vapi-storage";

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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const businessTypeFilter = searchParams.get("businessType");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 1000) : 50; // Max 1000

    // Get all calls from database
    let calls: Call[];
    try {
      calls = await listCalls();
      console.log(`[Admin] Found ${calls.length} calls in database`);
    } catch (error: any) {
      console.error("[Admin] Error fetching calls from database:", error);
      return NextResponse.json(
        { 
          error: "Failed to fetch calls from database",
          details: error?.message,
        },
        { status: 500 }
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
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

