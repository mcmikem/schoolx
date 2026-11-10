/**
 * This legacy endpoint changed a school's plan directly without a settled
 * payment. Plan changes must use the quote + payment + verified settlement
 * flow, which records the payment intent and activates a plan only after
 * confirmation.
 */
function retired() {
  return new Response(
    JSON.stringify({
      error: "Direct plan changes are no longer available.",
      message: "Use the billing page to request a quote and complete payment.",
      replacement: "/api/payment/checkout",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json" },
    },
  );
}

export async function POST() {
  return retired();
}
