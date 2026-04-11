import { NextRequest, NextResponse } from "next/server";

// Debug logging endpoint — only active in development.
// In production this is a no-op to avoid leaking session data to localhost.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const payload = await req.json();
    // Development-only: log to server console instead of a hardcoded localhost port
    console.debug("[debug/log]", JSON.stringify(payload));
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
