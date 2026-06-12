import { NextRequest, NextResponse } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  withSecurity,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import {
  formatUgandaPhone,
  getAfricasTalkingConfig,
  sendAfricasTalkingSMS,
  checkSmsDailyLimit,
} from "@/lib/africas-talking";
import { generateWhatsAppShareLink } from "@/lib/whatsapp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateRequest, smsRequestSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

const { apiKey: AFRICAS_TALKING_API_KEY } = getAfricasTalkingConfig();
const SMS_ALLOWED_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
  "secretary",
];

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const validation = validateRequest(smsRequestSchema, body);
    if (!validation.success) {
      return apiError(validation.error, 400);
    }

    const { phone, message, schoolId, studentId } = validation.data;

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: SMS_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const supabase = createServiceRoleClientOrThrow();
    const subCheck = await requireActiveSubscription({
      supabase,
      schoolId,
      requiredPlan: "starter",
    });
    if (!subCheck.ok) return subCheck.response;

    const withinLimit = await checkSmsDailyLimit(schoolId, 1);
    if (!withinLimit) {
      return apiError(
        "Daily SMS limit reached. Please try again tomorrow or contact support.",
        429,
      );
    }

    if (!phone) {
      return apiError("Phone number is required", 400);
    }

    const formattedPhone = formatUgandaPhone(phone);
    const result = await sendAfricasTalkingSMS(formattedPhone, message, {
      from: "SKOOLMATE",
    });

    if (result.success) {
      return apiSuccess({
        status: "sent",
        channel: "sms",
        messageId: result.messageId,
        statusCode: result.statusCode,
        demo: !AFRICAS_TALKING_API_KEY,
      });
    }

    let portalNotificationQueued = false;
    if (studentId) {
      try {
        const { data: student } = await supabase
          .from("students")
          .select("id, parent_id, first_name, last_name")
          .eq("id", studentId)
          .single();

        if (student?.parent_id) {
          const { error: notifyError } = await supabase
            .from("parent_notifications")
            .insert({
              school_id: schoolId,
              parent_id: student.parent_id,
              student_id: student.id,
              type: "message",
              title: "Message available",
              message: `A school message for ${student.first_name} ${student.last_name} is available in the parent portal.`,
              action_url: "/parent-portal/messages",
            });

          portalNotificationQueued = !notifyError;
        }
      } catch (fallbackError) {
        logger.warn("[SMS] Portal fallback notification failed:", fallbackError);
      }
    }

    const whatsappLink = generateWhatsAppShareLink(formattedPhone, message);
    return apiSuccess(
      {
        status: "fallback",
        channel: "whatsapp_share_link",
        smsError: result.error,
        whatsappLink,
        portalNotificationQueued,
      },
      "SMS provider failed. Fallbacks prepared.",
      200,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

async function handlePut(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const validation = validateRequest(smsRequestSchema, body);
    if (!validation.success) {
      return apiError(validation.error, 400);
    }

    const { phones, message, schoolId } = validation.data;

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: SMS_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    if (!phones || phones.length === 0) {
      return apiError("Phone list is required", 400);
    }

    const supabase = createServiceRoleClientOrThrow();
    const subCheck = await requireActiveSubscription({
      supabase,
      schoolId,
      requiredPlan: "starter",
    });
    if (!subCheck.ok) return subCheck.response;

    const withinLimit = await checkSmsDailyLimit(schoolId, phones.length);
    if (!withinLimit) {
      return apiError(
        "Daily SMS limit would be exceeded. Please reduce recipients or try again tomorrow.",
        429,
      );
    }

    const validPhones = phones.filter(
      (p): p is string =>
        typeof p === "string" && p.length >= 10 && p.length <= 15,
    );

    if (validPhones.length === 0) {
      return apiError("No valid phone numbers provided", 400);
    }

    const formattedPhones = validPhones.map(formatUgandaPhone);
    const results = [];

    for (const phone of formattedPhones) {
      const result = await sendAfricasTalkingSMS(phone, message, {
        from: "SKOOLMATE",
      });
      results.push({ phone, ...result });
    }

    const successCount = results.filter((r) => r.success).length;

    return apiSuccess({
      totalSent: successCount,
      totalFailed: results.length - successCount,
      results,
      demo: !AFRICAS_TALKING_API_KEY,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Africa's Talking delivery report callback
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: SMS_ALLOWED_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("schoolId") || auth.context.schoolId;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const supabase = await createSupabaseServerClient();
    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, phone, message, status, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return apiError("Failed to fetch messages", 500);
    }

    return apiSuccess({ messages: messages || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const expected = process.env.AFRICAS_TALKING_DELIVERY_SECRET;
    if (!expected) {
      logger.warn("[SMS] AFRICAS_TALKING_DELIVERY_SECRET is not set — delivery reports cannot be verified");
      return apiError("Server misconfigured: delivery secret not set", 503);
    }
    const provided = request.headers.get("x-delivery-secret");
    if (provided !== expected) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { id, status, phoneNumber, failureReason } = body;

    logger.debug(
      `[SMS Delivery] ID: ${id}, Status: ${status}, Phone: ${phoneNumber}`,
    );

    const supabase = createServiceRoleClientOrThrow();
    await supabase
      .from("messages")
      .update({ status })
      .eq("message_id", id);

    // Try updating delivery_status separately for graceful degradation
    try {
      await supabase
        .from("messages")
        .update({ delivery_status: status })
        .eq("message_id", id);
    } catch {
      // delivery_status column may not exist in older schema
    }

    return apiSuccess({ received: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withSecurity(handlePost, {
  rateLimit: { limit: 30, windowMs: 60000 },
});
export const PUT = withSecurity(handlePut, {
  rateLimit: { limit: 10, windowMs: 60000 },
});
// PATCH is exported above as the delivery report handler
