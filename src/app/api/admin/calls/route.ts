import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import { Call } from "@/lib/vapi-storage";

export const runtime = "nodejs";

async function ensureDataDir() {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

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

    // Ensure data directory exists
    await ensureDataDir();

    // Read call files from data directory
    let callFiles: string[] = [];
    try {
      const files = await fsPromises.readdir(DATA_DIR);
      callFiles = files.filter(
        (file) => file.startsWith("call-") && file.endsWith(".json")
      );
      console.log(`[Admin] Found ${callFiles.length} call files in ${DATA_DIR}`);
    } catch (error: any) {
      console.error("[Admin] Error reading data directory:", error);
      console.error("[Admin] DATA_DIR path:", DATA_DIR);
      console.error("[Admin] Directory exists:", fs.existsSync(DATA_DIR));
      return NextResponse.json(
        { 
          error: "Failed to read data directory",
          details: error?.message,
          dataDir: DATA_DIR,
          exists: fs.existsSync(DATA_DIR)
        },
        { status: 500 }
      );
    }

    // Parse call files safely
    const calls: Call[] = [];
    for (const file of callFiles) {
      try {
        const filePath = path.join(DATA_DIR, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const call = JSON.parse(fileContent) as Call;

        // Validate it's a call object
        if (!call || typeof call !== "object" || !call.callId) {
          console.warn(`[Admin] Skipping invalid call file: ${file}`);
          continue;
        }

        // Apply businessType filter if specified
        if (businessTypeFilter && call.businessType !== businessTypeFilter) {
          continue;
        }

        calls.push(call);
      } catch (error) {
        // Log warning for broken JSON but continue processing other files
        console.warn(`[Admin] Failed to parse call file ${file}:`, error);
        continue;
      }
    }

    // Sort calls
    calls.sort((a, b) => {
      // Try to sort by createdAt first
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;

      // Fallback to file modification time
      try {
        const fileA = path.join(DATA_DIR, `call-${a.id}.json`);
        const fileB = path.join(DATA_DIR, `call-${b.id}.json`);
        const statA = fs.statSync(fileA);
        const statB = fs.statSync(fileB);
        return statB.mtime.getTime() - statA.mtime.getTime();
      } catch {
        return 0;
      }
    });

    // Apply limit
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

