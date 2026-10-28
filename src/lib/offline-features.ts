/**
 * Features that cannot complete without the server.
 *
 * The app is offline-first for the work a school does on a normal day:
 * registers, marks, fees, students, messages that are queued, and every screen
 * whose data was already saved on the device. A few operations are different
 * because their result is owned by somebody else — a payment provider, an SMS
 * gateway, an AI service, a government portal. Those are still reachable
 * offline (the page is cached), but they are labelled as needing a connection
 * before the user starts, instead of failing halfway through.
 */
export interface OnlineOnlyFeature {
  prefix: string;
  label: string;
  reason: string;
}

export const ONLINE_ONLY_FEATURES: readonly OnlineOnlyFeature[] = [
  {
    prefix: "/dashboard/billing",
    label: "Billing and payments",
    reason: "Payments are confirmed by the payment provider.",
  },
  {
    prefix: "/dashboard/pricing",
    label: "Plan changes",
    reason: "Subscription changes are confirmed by the billing server.",
  },
  {
    prefix: "/dashboard/payment-plans",
    label: "Payment plans",
    reason: "Payment plans are confirmed by the billing server.",
  },
  {
    prefix: "/dashboard/bulk-sms",
    label: "Bulk SMS",
    reason: "Messages are delivered by the SMS provider.",
  },
  {
    prefix: "/dashboard/auto-sms",
    label: "Automatic SMS",
    reason: "Messages are delivered by the SMS provider.",
  },
  {
    prefix: "/dashboard/sms-delivery",
    label: "SMS delivery reports",
    reason: "Delivery reports come from the SMS provider.",
  },
  {
    prefix: "/dashboard/sms-templates",
    label: "SMS templates",
    reason: "Saved templates are stored on the server.",
  },
  {
    prefix: "/dashboard/import",
    label: "Data import",
    reason: "Imported files are validated on the server before they are saved.",
  },
  {
    prefix: "/dashboard/osx",
    label: "Owly AI",
    reason: "AI answers are generated on the server.",
  },
  {
    prefix: "/dashboard/system-health",
    label: "System health",
    reason: "This screen reads live server status.",
  },
  {
    prefix: "/dashboard/schools",
    label: "All schools",
    reason: "This screen reads live platform data.",
  },
  {
    prefix: "/super-admin",
    label: "Super admin",
    reason: "This screen reads live platform data.",
  },
  {
    prefix: "/dashboard/moes",
    label: "MoES reporting",
    reason: "Reports are submitted to the Ministry server.",
  },
  {
    prefix: "/dashboard/moes-reports",
    label: "MoES reports",
    reason: "Reports are submitted to the Ministry server.",
  },
  {
    prefix: "/dashboard/uneb",
    label: "UNEB",
    reason: "Registration data is submitted to the UNEB server.",
  },
  {
    prefix: "/dashboard/uneb-registration",
    label: "UNEB registration",
    reason: "Registration data is submitted to the UNEB server.",
  },
];

function normalisePath(pathname: string): string {
  if (!pathname) return "";
  const withoutQuery = pathname.split("?")[0].split("#")[0];
  return withoutQuery.length > 1 && withoutQuery.endsWith("/") ? withoutQuery.slice(0, -1) : withoutQuery;
}

export function getOnlineOnlyFeature(pathname: string): OnlineOnlyFeature | null {
  const path = normalisePath(pathname);
  if (!path) return null;
  return (
    ONLINE_ONLY_FEATURES.find((feature) => path === feature.prefix || path.startsWith(`${feature.prefix}/`)) ?? null
  );
}

export function isOnlineOnlyPath(pathname: string): boolean {
  return getOnlineOnlyFeature(pathname) !== null;
}

/** A short sentence for the global offline banner. */
export function onlineOnlySummary(pathname: string): string | null {
  const feature = getOnlineOnlyFeature(pathname);
  if (!feature) return null;
  return `${feature.label} needs internet. ${feature.reason}`;
}
