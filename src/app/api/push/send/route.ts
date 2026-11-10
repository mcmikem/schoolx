import { NextRequest } from "next/server";
import webpush from "web-push";
import {
  apiSuccess,
  apiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  rateLimit,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { isAllowedWebPushEndpoint, isValidWebPushKeys } from "@/lib/push-security";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@skoolmate.org";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const ALLOWED = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];
export async function POST(request: NextRequest) {
  let admin: ReturnType<typeof createServiceRoleClientOrThrow> | null = null;
  let senderUserId = "";
  let recipientUserId = "";
  let schoolId = "";
  const receiptId = crypto.randomUUID();
  const writeReceipt = async (status: "accepted_by_provider" | "failed" | "expired", providerStatus: number | null) => {
    if (!admin || !senderUserId || !recipientUserId || !schoolId) return;
    try {
      const { error } = await admin.from("push_delivery_receipts").insert({
        id: receiptId,
        school_id: schoolId,
        sender_user_id: senderUserId,
        recipient_user_id: recipientUserId,
        status,
        provider_status: providerStatus,
      });
      if (error) logger.warn("[Push Send] Could not persist delivery receipt", { code: error.code || "unknown" });
    } catch (error) {
      logger.warn("[Push Send] Delivery receipt write failed", {
        code:
          error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "unknown",
      });
    }
  };
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    senderUserId = auth.context.user.id;

    const roleCheck = assertUserRoleOrDeny({ userRole: auth.context.user.role, allowedRoles: ALLOWED });
    if (!roleCheck.ok) return roleCheck.response;

    const limit = rateLimit(request, 30, 60_000);
    if (!limit.success) return apiError("Too many push requests", 429);

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return apiError("Push not configured", 503);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const requestedRecipientUserId = typeof body?.recipientUserId === "string" ? body.recipientUserId.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const url = typeof body?.url === "string" ? body.url : "/dashboard/";
    const tag = typeof body?.tag === "string" ? body.tag.slice(0, 100) : undefined;

    if (!requestedRecipientUserId || requestedRecipientUserId.length > 100)
      return apiError("recipientUserId is required", 400);
    if (!title || title.length > 120 || !message || message.length > 500) {
      return apiError("Title and message are required and must be within the supported length", 400);
    }
    if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
      return apiError("Notification URL must be a local application path", 400);
    }

    if (!auth.context.schoolId) return apiError("School context is required", 403);
    schoolId = auth.context.schoolId;
    admin = createServiceRoleClientOrThrow();
    const { data: recipient, error: recipientError } = await admin
      .from("users")
      .select("id, school_id")
      .eq("id", requestedRecipientUserId)
      .maybeSingle();

    if (recipientError) throw recipientError;
    if (!recipient || recipient.school_id !== auth.context.schoolId) return apiError("Recipient not found", 404);
    recipientUserId = recipient.id;

    const { data: saved, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", recipient.id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    if (!saved) return apiError("Recipient has no registered push device", 404);
    if (!isAllowedWebPushEndpoint(saved.endpoint) || !isValidWebPushKeys(saved.keys)) {
      logger.warn("[Push Send] Refusing malformed or unsupported saved endpoint", { recipientUserId });
      return apiError("Saved push subscription is invalid", 400);
    }

    const providerResponse = await webpush.sendNotification(
      { endpoint: saved.endpoint, keys: saved.keys },
      JSON.stringify({ title, body: message, url, tag }),
    );
    await writeReceipt("accepted_by_provider", Number(providerResponse?.statusCode) || 201);

    return apiSuccess({ sent: true, receiptId }, "Push accepted by delivery provider");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Push failed";
    const providerStatus =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode) || null
        : null;
    const expired = providerStatus === 410 || providerStatus === 404 || msg.includes("410") || msg.includes("404");
    logger.error("[Push Send] Delivery failed", { status: providerStatus || "unknown" });
    try {
      await writeReceipt(expired ? "expired" : "failed", providerStatus);
    } catch (receiptError) {
      logger.warn("[Push Send] Delivery receipt write failed", {
        code:
          receiptError && typeof receiptError === "object" && "code" in receiptError
            ? String((receiptError as { code: unknown }).code)
            : "unknown",
      });
    }
    if (expired) return apiError("Subscription expired", 410, receiptId);
    return apiError("Push delivery failed", 502, receiptId);
  }
}
