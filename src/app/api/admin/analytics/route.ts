import { NextRequest, NextResponse } from "next/server";
import { listCalls } from "@/lib/vapi-storage";

export const runtime = "nodejs";

/**
 * GET /api/admin/analytics
 * Analytics endpoint for assistant usage
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

    // Get all calls
    const calls = listCalls();

    // Calculate analytics
    const totalCalls = calls.length;
    
    // Calls per type
    const callsByType = {
      car: calls.filter(c => c.businessType === "car").length,
      restaurant: calls.filter(c => c.businessType === "restaurant").length,
      router: calls.filter(c => !c.businessType || c.businessType === "router").length,
    };

    // Duration per type
    const durationByType = {
      car: calculateAverageDuration(calls.filter(c => c.businessType === "car")),
      restaurant: calculateAverageDuration(calls.filter(c => c.businessType === "restaurant")),
      router: calculateAverageDuration(calls.filter(c => !c.businessType || c.businessType === "router")),
    };

    // Total duration per type
    const totalDurationByType = {
      car: calculateTotalDuration(calls.filter(c => c.businessType === "car")),
      restaurant: calculateTotalDuration(calls.filter(c => c.businessType === "restaurant")),
      router: calculateTotalDuration(calls.filter(c => !c.businessType || c.businessType === "router")),
    };

    // Confidence statistics
    const confidenceStats = {
      car: calculateConfidenceStats(calls.filter(c => c.businessType === "car")),
      restaurant: calculateConfidenceStats(calls.filter(c => c.businessType === "restaurant")),
      router: calculateConfidenceStats(calls.filter(c => !c.businessType || c.businessType === "router")),
    };

    return NextResponse.json({
      summary: {
        totalCalls,
        callsByType,
      },
      duration: {
        average: durationByType,
        total: totalDurationByType,
      },
      confidence: confidenceStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Admin] Error processing analytics:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Calculate average duration for a set of calls
 */
function calculateAverageDuration(calls: any[]): number | null {
  const durations = calls
    .filter(c => c.durationSeconds !== undefined && c.durationSeconds !== null)
    .map(c => c.durationSeconds);
  
  if (durations.length === 0) return null;
  
  const sum = durations.reduce((a, b) => a + b, 0);
  return Math.round(sum / durations.length);
}

/**
 * Calculate total duration for a set of calls
 */
function calculateTotalDuration(calls: any[]): number {
  return calls
    .filter(c => c.durationSeconds !== undefined && c.durationSeconds !== null)
    .reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
}

/**
 * Calculate confidence statistics
 */
function calculateConfidenceStats(calls: any[]): {
  average: number | null;
  min: number | null;
  max: number | null;
  count: number;
} {
  const confidences = calls
    .filter(c => c.confidence !== undefined && c.confidence !== null)
    .map(c => c.confidence);
  
  if (confidences.length === 0) {
    return { average: null, min: null, max: null, count: 0 };
  }
  
  const sum = confidences.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / confidences.length) * 100) / 100;
  const min = Math.min(...confidences);
  const max = Math.max(...confidences);
  
  return { average, min, max, count: confidences.length };
}

