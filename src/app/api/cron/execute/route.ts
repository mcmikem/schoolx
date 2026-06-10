import { NextRequest, NextResponse } from "next/server";
import {
  requireUserWithSchool,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: ["super_admin", "school_admin", "admin"],
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { endpoint, body } = await request.json();

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { success: false, error: "endpoint is required" },
        { status: 400 },
      );
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 },
      );
    }

    const origin = request.nextUrl.origin;
    const targetUrl = `${origin}/api/automation/${endpoint}/`;

    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    logger.error("Cron execute proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
