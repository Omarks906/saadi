import { NextRequest, NextResponse } from "next/server";
import { listFailedPrintJobs } from "@/lib/printing/print-jobs";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

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
    const status = req.nextUrl.searchParams.get("status") || "failed";
    if (status !== "failed") {
      return NextResponse.json(
        { error: "Only status=failed is supported" },
        { status: 400 }
      );
    }

    const org = await requireAdminOrg(req);
    const jobs = await listFailedPrintJobs({
      organizationId: org.id,
      limit: 50,
    });

    return NextResponse.json({ jobs, count: jobs.length });
  } catch (error: any) {
    console.error("[Admin] Error fetching print jobs:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
