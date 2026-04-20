import { createPayPalOrder } from "@/lib/payments/paypal";
import { NextResponse } from "next/server";
import { requireDevelopmentRouteOrDeny } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const devOnly = requireDevelopmentRouteOrDeny();
  if (!devOnly.ok) return devOnly.response;

  try {
    // Test creating an order
    const order = await createPayPalOrder(
      2999,
      "USD",
      "test-subscription-123",
      "http://localhost:3000/success",
      "http://localhost:3000/cancel",
    );
    return NextResponse.json({ success: true, orderId: order.result?.id });
  } catch (error: any) {
    console.error("❌ PayPal test failed:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
