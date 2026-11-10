import { NextResponse } from "next/server";

/**
 * Account deletion is handled as a reviewed privacy request. Removing an auth
 * account here would revoke access while leaving school records untouched.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct account deletion is unavailable. Submit a privacy request to your school or contact os@omuto.org for review.",
      request_url: "mailto:os@omuto.org?subject=SkoolMate%20privacy%20request",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
