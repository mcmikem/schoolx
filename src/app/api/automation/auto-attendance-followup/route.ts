import { NextRequest, NextResponse } from "next/server";
import { detectConsecutiveAbsenceAlerts, filterAbsenceAlertsForCooldown } from "@/lib/operations";
import type { AttendanceAlert } from "@/lib/operations";
import {
  apiError,
  handleApiError,
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";
import { sendToParent } from "@/lib/messaging-server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const body = await request.json().catch(() => null);
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId : "";
    const threshold: unknown = body?.threshold === undefined ? 3 : body.threshold;
    if (!schoolId) return apiError("A school is required", 400);
    if (!Number.isInteger(threshold) || (threshold as number) < 1 || (threshold as number) > 30) {
      return apiError("Threshold must be a whole number from 1 to 30", 400);
    }

    const supabase = createServiceRoleClientOrThrow();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    const absenceThreshold = threshold as number;

    // Get all active students
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, first_name, last_name, parent_phone, class_id")
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (studentsError) {
      return apiError("Unable to prepare attendance follow-up. Please retry.", 500);
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { studentsFlagged: 0, smsSent: 0, skipped: 0, errors: 0, threshold: absenceThreshold },
      });
    }

    const studentIds = students.map((s: any) => s.id);

    // Get attendance records for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("student_id, date, status")
      .in("student_id", studentIds)
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false });

    if (attendanceError) {
      return apiError("Unable to prepare attendance follow-up. Please retry.", 500);
    }

    // Detect consecutive absence alerts using existing utility
    const alerts = detectConsecutiveAbsenceAlerts({
      students: students as any,
      attendance: attendance || [],
      trigger: {
        threshold_days: absenceThreshold,
        is_active: true,
      },
    });

    // Check cooldown - filter out students who were already notified recently
    const { data: recentLogs } = await supabase
      .from("automated_message_logs")
      .select("trigger_id, trigger_key, record_id, status, sent_at")
      .eq("school_id", school.schoolId)
      .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const alertsToSend = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: "auto-attendance-followup",
      recentLogs: recentLogs || [],
      cooldownHours: 24,
    });

    let studentsFlagged = 0;
    let smsSent = 0;
    let skipped = 0;
    let errorCount = 0;
    const sentAt = new Date().toISOString();

    for (const alert of alerts as AttendanceAlert[]) {
      const shouldSend = alertsToSend.some((a) => a.studentId === alert.studentId);

      studentsFlagged++;

      if (!shouldSend) {
        skipped++;
        continue;
      }

      if (!alert.parentPhone) {
        skipped++;
        continue;
      }

      // Send to the parent on the school's configured channel (WhatsApp-first, SMS fallback)
      try {
        const smsResult = await sendToParent(supabase, {
          schoolId: school.schoolId,
          to: alert.parentPhone,
          message: alert.smsMessage,
          kind: "absentee_alert",
        });

        if (smsResult.success) {
          const { withTimeout, timeoutFallback } = await import("@/lib/hooks/utils");
          // Log the message
          const attMsgResult = await withTimeout(
            supabase.from("messages").insert({
              school_id: school.schoolId,
              recipient_type: "individual",
              recipient_id: alert.studentId,
              phone: alert.parentPhone,
              message: alert.smsMessage,
              status: "sent",
              sent_at: sentAt,
            } as any),
            15000,
            timeoutFallback(),
          );
          if (attMsgResult?.error) {
            logger.error("Attendance followup message insert failed");
          }

          // Log the automated message
          const attLogResult = await withTimeout(
            supabase.from("automated_message_logs").insert({
              school_id: school.schoolId,
              trigger_id: null,
              trigger_key: "auto-attendance-followup",
              recipient_id: null,
              record_id: alert.studentId,
              status: "sent",
              sent_at: sentAt,
            } as any),
            15000,
            timeoutFallback(),
          );
          if (attLogResult?.error) {
            logger.error("Attendance followup delivery log insert failed");
          }

          smsSent++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        studentsFlagged,
        smsSent,
        skipped,
        errors: errorCount,
        threshold: absenceThreshold,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
