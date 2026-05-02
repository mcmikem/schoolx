import { NextResponse } from "next/server";
import { requireDevelopmentRouteOrDeny } from "@/lib/api-utils";

export async function POST() {
  const devOnly = requireDevelopmentRouteOrDeny();
  if (!devOnly.ok) return devOnly.response;
  return NextResponse.json({ ok: true }, { status: 204 });
}