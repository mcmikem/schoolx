import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireAuthenticatedUser,
  withSecurity,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  detectConsecutiveAbsenceAlerts,
  filterAbsenceAlertsForCooldown,
} from "@/lib/operations";

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { schoolId, triggerId } = body as {
      schoolId?: string;
      triggerId?: string;
    };

    if (!schoolId || !triggerId) {
      return apiError("School ID and trigger ID are required", 400);
    }

    const supabase = await createSupabaseServerClient();
    const { data: actor } = await supabase
      .from("users")
      .select("id, school_id, role, full_name")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!actor || actor.school_id !== schoolId) {
      return apiError("Unauthorized for this school", 403);
    }

    const { data: trigger, error: triggerError } = await supabase
      .from("sms_triggers")
      .select("*")
      .eq("id", triggerId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (triggerError || !trigger) {
      return apiError("Trigger not found", 404);
    }

    if (!trigger.is_active) {
      return apiError("Trigger is inactive", 400);
    }

    if (trigger.event_type !== "student_absent") {
      return apiError(
        "Only student absence automation is supported by this runner for now",
        400,
      );
    }

    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, parent_phone")
      .eq("school_id", schoolId)
      .eq("status", "active");

    const studentIds = (students || []).map(
      (student: { id: string }) => student.id,
    );
    const { data: attendance } =
      studentIds.length === 0
        ? { data: [] }
        : await supabase
            .from("attendance")
            .select("student_id, date, status")
            .in("student_id", studentIds)
            .gte(
              "date",
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
            )
            .order("date", { ascending: false });

    const alerts = detectConsecutiveAbsenceAlerts({
      students: students || [],
      attendance: attendance || [],
      trigger: {
        threshold_days: trigger.threshold_days,
        is_active: trigger.is_active,
      },
    });

    const { data: recentLogs } = await supabase
      .from("automated_message_logs")
      .select("trigger_id, record_id, status, sent_at, created_at")
      .eq("school_id", schoolId)
      .eq("trigger_id", trigger.id)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );

    const alertsToSend = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: trigger.id,
      recentLogs: recentLogs || [],
      cooldownHours: 24,
    });

    const sentAt = new Date().toISOString();
    let createdMessages = 0;

    for (const alert of alertsToSend) {
      const { error: messageError } = await supabase.from("messages").insert({
        school_id: schoolId,
        recipient_type: "individual",
        recipient_id: alert.studentId,
        phone: alert.parentPhone,
        message: alert.smsMessage,
        status: alert.shouldSendSms ? "sent" : "failed",
        sent_by: actor.id,
        sent_at: alert.shouldSendSms ? sentAt : null,
      });

      if (!messageError) {
        createdMessages += 1;
      }

      await supabase.from("automated_message_logs").insert({
        school_id: schoolId,
        trigger_id: trigger.id,
        recipient_id: alert.parentPhone || null,
        record_id: alert.studentId,
        status: alert.shouldSendSms ? "sent" : "failed",
        sent_at: sentAt,
      });
    }

    await supabase
      .from("sms_triggers")
      .update({ last_run_at: sentAt })
      .eq("id", trigger.id);

    await supabase.from("audit_log").insert({
      school_id: schoolId,
      user_id: actor.id,
      user_name: actor.full_name,
      action: "create",
      module: "automation",
      description: `Ran SMS trigger ${trigger.name} (${alertsToSend.length} message candidate${alertsToSend.length === 1 ? "" : "s"})`,
      record_id: trigger.id,
      new_value: {
        event_type: trigger.event_type,
        threshold_days: trigger.threshold_days,
        alertsMatched: alerts.length,
        messagesCreated: createdMessages,
        suppressedByCooldown: Math.max(0, alerts.length - alertsToSend.length),
      },
    });

    return apiSuccess({
      triggerId: trigger.id,
      eventType: trigger.event_type,
      threshold: trigger.threshold_days,
      alertsMatched: alerts.length,
      suppressedByCooldown: Math.max(0, alerts.length - alertsToSend.length),
      messagesCreated: createdMessages,
      runAt: sentAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withSecurity(handlePost, {
  rateLimit: { limit: 20, windowMs: 60000 },
});
