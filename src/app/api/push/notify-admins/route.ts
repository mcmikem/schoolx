import { NextRequest } from "next/server";
import * as webpush from "web-push";
import { apiSuccess, apiError, requireUserWithSchool, createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { isAllowedWebPushEndpoint, isValidWebPushKeys } from "@/lib/push-security";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@skoolmate.org";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const ADMIN_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "bursar", "secretary"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    if (!auth.context.schoolId) return apiError("School context is required", 403);

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return apiError("Push not configured", 503);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "New parent message";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const url = typeof body?.url === "string" ? body.url : "/dashboard/parent-inbox";
    const schoolId = auth.context.schoolId;

    if (!message) return apiError("Message is required", 400);

    const admin = createServiceRoleClientOrThrow();
    const { data: admins } = await admin.from("users").select("id").eq("school_id", schoolId).in("role", ADMIN_ROLES);

    const adminIds = (admins || []).map((a: any) => a.id);
    if (adminIds.length === 0) return apiSuccess({ sent: 0 }, "No admins");

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, keys, user_id")
      .in("user_id", adminIds);

    let sent = 0;
    for (const sub of subs || []) {
      if (!isAllowedWebPushEndpoint(sub.endpoint) || !isValidWebPushKeys(sub.keys)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title, body: message, url, tag: "parent-message" }),
        );
        sent++;
      } catch (err) {
        logger.warn("[Push] Failed to send to admin", err);
      }
    }

    return apiSuccess({ sent }, "Push dispatched");
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Push failed", 500);
  }
}
