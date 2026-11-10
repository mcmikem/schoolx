import { NextResponse } from "next/server";

/**
 * Retired legacy endpoint: provider references were not bound to a
 * server-created payment intent, so a verified payment could be attributed to
 * an unrelated learner. The parent portal uses reviewed fee-payment claims.
 */
export function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Online fee payment is temporarily unavailable. Submit a payment claim for school review.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
