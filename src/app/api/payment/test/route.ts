import { NextResponse } from "next/server";
import { requireDevelopmentRouteOrDeny } from "@/lib/api-utils";

export async function GET() {
  const devOnly = requireDevelopmentRouteOrDeny();
  if (!devOnly.ok) return devOnly.response;
  return NextResponse.json({
    status: "ok",
    message: "Payment webhook endpoints are accessible",
    timestamp: new Date().toISOString(),
    endpoints: {
      stripeWebhook: "/api/payment/webhook",
      paypalWebhook: "/api/payment/paypal/webhook",
    },
  });
}

export async function POST() {
  const devOnly = requireDevelopmentRouteOrDeny();
  if (!devOnly.ok) return devOnly.response;
  return NextResponse.json({
    status: "ok",
    message: "POST request received",
    timestamp: new Date().toISOString(),
  });
}
