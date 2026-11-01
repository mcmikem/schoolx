import { NextRequest } from "next/server";
import webpush from "web-push";
import { apiSuccess, apiError, requireUserWithSchool, assertUserRoleOrDeny } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@skoolmate.org";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const ALLOWED = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({ userRole: auth.context.user.role, allowedRoles: ALLOWED });
    if (!roleCheck.ok) return roleCheck.response;

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return apiError("Push not configured (missing VAPID keys)", 503);
    }

    const body = await request.json();
    const { subscription, title, message, url, tag } = body;

    if (!subscription?.endpoint) {
      return apiError("subscription.endpoint required", 400);
    }

    await webpush.sendNotification(subscription, JSON.stringify({ title, body: message, url, tag }));

    return apiSuccess({ sent: true }, "Push sent");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Push failed";
    logger.error("[Push Send]", msg);
    // Subscription expired/invalid — caller should remove it.
    if (msg.includes("410") || msg.includes("404")) {
      return apiError("Subscription expired", 410);
    }
    return apiError(msg, 500);
  }
}
