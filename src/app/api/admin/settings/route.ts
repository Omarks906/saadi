import { NextRequest, NextResponse } from "next/server";
import { getOrganizationSettings, updateOrganizationSettings } from "@/lib/vapi-storage";
import { requireAdminOrg, toAdminErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/settings
 * Get organization settings
 */
export async function GET(req: NextRequest) {
  try {
    const org = await requireAdminOrg(req);
    const settings = await getOrganizationSettings(org.id);
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("[Admin] Error getting settings:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json(
      { error: response.error },
      { status: response.status }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update organization settings
 */
export async function PUT(req: NextRequest) {
  try {
    const org = await requireAdminOrg(req);
    const body = await req.json();

    // Validate language if provided
    if (body.language && !["en", "sv"].includes(body.language)) {
      return NextResponse.json(
        { error: "Invalid language. Must be 'en' or 'sv'" },
        { status: 400 }
      );
    }

    const settings = await updateOrganizationSettings(org.id, body);
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("[Admin] Error updating settings:", error);
    const response = toAdminErrorResponse(error);
    return NextResponse.json(
      { error: response.error },
      { status: response.status }
    );
  }
}
