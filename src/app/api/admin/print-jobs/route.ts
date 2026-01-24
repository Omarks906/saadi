import { NextRequest, NextResponse } from "next/server";
import { listFailedPrintJobs } from "@/lib/printing/print-jobs";
import { resolveOrgContext } from "@/lib/org-context";

export const runtime = "nodejs";

/**
 * GET /api/admin/print-jobs?status=failed
 * Admin endpoint to list recent failed print jobs for the tenant
 *
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(req: NextRequest) {
  try {
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

    const status = req.nextUrl.searchParams.get("status") || "failed";
    if (status !== "failed") {
      return NextResponse.json(
        { error: "Only status=failed is supported" },
        { status: 400 }
      );
    }

    const org = await resolveOrgContext(req);
    const jobs = await listFailedPrintJobs({
      organizationId: org.id,
      limit: 50,
    });

    return NextResponse.json({ jobs, count: jobs.length });
  } catch (error: any) {
    console.error("[Admin] Error fetching print jobs:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
