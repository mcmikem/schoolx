// ============================================================================
// 📦 App Version API Endpoint
// ============================================================================
// Returns the current app version and update information.
// Used by the frontend to check for updates and mandatory updates.
// ============================================================================

import { NextResponse } from "next/server";
import { getAppVersion } from "@/lib/api-versioning";

const CURRENT_VERSION = getAppVersion();

/**
 * Minimum version required for the app to function.
 * Clients with versions below this will be forced to update.
 */
const MINIMUM_VERSION = "1.0.0";

/**
 * Known issues that users should be aware of.
 */
const KNOWN_ISSUES: Array<{ id: string; title: string; description: string; since: string }> = [];

/**
 * Planned maintenance windows.
 */
const MAINTENANCE_WINDOWS: Array<{ start: string; end: string; message: string }> = [];

export async function GET() {
  return NextResponse.json({
    current_version: CURRENT_VERSION,
    minimum_version: MINIMUM_VERSION,
    new_version: null, // Set this when a new version is deployed
    message: null, // Custom message for users
    critical: false, // If true, forces update
    known_issues: KNOWN_ISSUES,
    maintenance_windows: MAINTENANCE_WINDOWS,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST - Admin only: Update version information
 * Used when deploying a new version to notify clients
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // In production, this should be protected by admin authentication
    // For now, we just return the current config
    return NextResponse.json({
      success: true,
      current_version: CURRENT_VERSION,
      minimum_version: MINIMUM_VERSION,
      known_issues: KNOWN_ISSUES,
      maintenance_windows: MAINTENANCE_WINDOWS,
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
