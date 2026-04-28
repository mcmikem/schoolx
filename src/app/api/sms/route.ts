import { NextRequest, NextResponse } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  withSecurity,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";
import {
  formatUgandaPhone,
  getAfricasTalkingConfig,
  sendAfricasTalkingSMS,
} from "@/lib/africas-talking";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const { apiKey: AFRICAS_TALKING_API_KEY } = getAfricasTalkingConfig();
const SMS_ALLOWED_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
  "secretary",
];

interface SMSRequest {
  phone: string;
  message: string;
  schoolId: string;
  studentId?: string;
  type: "individual" | "class" | "all";
}

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body: SMSRequest = await request.json();
    const { phone, message, schoolId } = body;

    if (!phone || !message) {
      return apiError("Phone and message are required", 400);
    }

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

    if (typeof phone !== "string" || phone.length < 10 || phone.length > 15) {
      return apiError("Invalid phone number format", 400);
    }

    if (
      typeof message !== "string" ||
      message.length === 0 ||
      message.length > 1000
    ) {
      return apiError("Message must be between 1 and 1000 characters", 400);
    }

    const formattedPhone = formatUgandaPhone(phone);
    const result = await sendAfricasTalkingSMS(formattedPhone, message, {
      from: "SKOOLMATE",
    });

    if (result.success) {
      return apiSuccess({
        status: "sent",
        messageId: result.messageId,
        statusCode: result.statusCode,
        demo: !AFRICAS_TALKING_API_KEY,
      });
    }

    return apiError(
      "Failed to send SMS. Please verify the phone number and try again.",
      500,
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
    const { phones, message, schoolId } = body;

    if (!phones || !phones.length || !message) {
      return apiError("Phone list and message are required", 400);
    }

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

    if (!Array.isArray(phones) || phones.length > 100) {
      return apiError(
        "Phone list must be an array with maximum 100 recipients",
        400,
      );
    }

    if (
      typeof message !== "string" ||
      message.length === 0 ||
      message.length > 1000
    ) {
      return apiError("Message must be between 1 and 1000 characters", 400);
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
    // Require a shared secret for delivery callbacks to prevent spoofing.
    const expected = process.env.AFRICAS_TALKING_DELIVERY_SECRET;
    if (expected) {
      const provided = request.headers.get("x-delivery-secret");
      if (provided !== expected) {
        return apiError("Unauthorized", 401);
      }
    }

    // This endpoint receives delivery reports from Africa's Talking
    const body = await request.json();
    const { id, status, phoneNumber, failureReason } = body;

    // Log delivery status
    console.log(
      `[SMS Delivery] ID: ${id}, Status: ${status}, Phone: ${phoneNumber}`,
    );

    // In production, update the message record in database
    // await supabase.from('messages').update({ status, delivery_status: status }).eq('message_id', id)

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
