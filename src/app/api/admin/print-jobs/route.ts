import { NextRequest, NextResponse } from "next/server";
import { listRecentPrintJobs } from "@/lib/printing/print-jobs";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

const VALID_STATUSES = ["queued", "printing", "sent", "failed", "retrying", "all"];

/**
 * GET /api/admin/print-jobs?status=all&limit=50
 * Admin endpoint to list recent print jobs for the tenant.
 * status defaults to "all"; pass status=failed/queued/printing/sent/retrying to filter.
 *
 * Headers:
 * - x-admin-token: Must match ADMIN_TOKEN environment variable
 */
export async function GET(req: NextRequest) {
  try {
    const statusParam = req.nextUrl.searchParams.get("status") || "all";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;

    if (!VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const org = await requireAdminOrg(req);
    const jobs = await listRecentPrintJobs({
      organizationId: org.id,
      limit,
      status: statusParam === "all" ? undefined : statusParam,
    });

    return NextResponse.json({ jobs, count: jobs.length });
  } catch (error: any) {
    console.error("[Admin] Error fetching print jobs:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
