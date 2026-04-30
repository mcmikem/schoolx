import { NextRequest, NextResponse } from "next/server";
import {
  requireCronSecretOrDeny,
  requireDevelopmentRouteOrDeny,
} from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const devOnly = requireDevelopmentRouteOrDeny();
    if (!devOnly.ok) return devOnly.response;

    const cron = requireCronSecretOrDeny(req);
    if (!cron.ok) return cron.response;

    const body = await req.json();

    if (!body?.sql || typeof body.sql !== "string") {
      return NextResponse.json(
        { success: false, error: "SQL statement is required" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Direct SQL execution requires Supabase CLI or manual SQL Editor. Use the Supabase Dashboard SQL Editor for ad-hoc queries.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
}
