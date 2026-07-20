import { NextRequest, NextResponse } from "next/server";
import { detectConsecutiveAbsenceAlerts, filterAbsenceAlertsForCooldown } from "@/lib/operations";
import type { AttendanceAlert } from "@/lib/operations";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow, requireExistingSchoolOrDeny } from "@/lib/api-utils";
import { sendAfricasTalkingSMSWithRetry } from "@/lib/africas-talking";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const { schoolId, threshold } = await request.json();
    const supabase = createServiceRoleClientOrThrow();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    const absenceThreshold = threshold || 3;

    // Get all active students
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, first_name, last_name, parent_phone, class_id")
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (studentsError) {
      return NextResponse.json(
        { error: "Failed to fetch students", details: "Internal server error" },
        { status: 500 },
      );
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          studentsFlagged: 0,
          smsSent: 0,
          skipped: 0,
          errors: 0,
        },
        results: { flagged: [], skipped: [], errors: [] },
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
      return NextResponse.json(
        {
          error: "Failed to fetch attendance records",
          details: "Internal server error",
        },
        { status: 500 },
      );
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
      .select("trigger_id, record_id, status, sent_at")
      .eq("school_id", school.schoolId)
      .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const alertsToSend = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: "auto-attendance-followup",
      recentLogs: recentLogs || [],
      cooldownHours: 24,
    });

    const flagged: any[] = [];
    const smsResults: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];
    const sentAt = new Date().toISOString();

    for (const alert of alerts as AttendanceAlert[]) {
      const shouldSend = alertsToSend.some((a) => a.studentId === alert.studentId);

      flagged.push({
        studentId: alert.studentId,
        studentName: alert.studentName,
        consecutiveAbsentDays: alert.consecutiveAbsentDays,
        parentPhone: alert.parentPhone,
        shouldNotify: shouldSend,
      });

      if (!shouldSend) {
        skipped.push({
          studentId: alert.studentId,
          studentName: alert.studentName,
          reason: "Already notified within cooldown period (24h)",
        });
        continue;
      }

      if (!alert.parentPhone) {
        skipped.push({
          studentId: alert.studentId,
          studentName: alert.studentName,
          reason: "No parent phone number",
        });
        continue;
      }

      // Send SMS to parent
      try {
        const smsResult = await sendAfricasTalkingSMSWithRetry(alert.parentPhone, alert.smsMessage, {
          formatUgandaNumber: true,
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
            logger.error("Attendance followup message insert error:", attMsgResult.error);
          }

          // Log the automated message
          const attLogResult = await withTimeout(
            supabase.from("automated_message_logs").insert({
              school_id: school.schoolId,
              trigger_id: "auto-attendance-followup",
              recipient_id: alert.parentPhone,
              record_id: alert.studentId,
              status: "sent",
              sent_at: sentAt,
            } as any),
            15000,
            timeoutFallback(),
          );
          if (attLogResult?.error) {
            logger.error("Attendance followup log insert error:", attLogResult.error);
          }

          smsResults.push({
            studentId: alert.studentId,
            studentName: alert.studentName,
            phone: alert.parentPhone,
            messageId: smsResult.messageId,
          });
        } else {
          errors.push({
            studentId: alert.studentId,
            studentName: alert.studentName,
            reason: `SMS failed: ${smsResult.error}`,
          });
        }
      } catch (err) {
        errors.push({
          studentId: alert.studentId,
          studentName: alert.studentName,
          reason: "Attendance follow-up failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        studentsFlagged: flagged.length,
        smsSent: smsResults.length,
        skipped: skipped.length,
        errors: errors.length,
        threshold: absenceThreshold,
      },
      results: { flagged, smsResults, skipped, errors },
    });
  } catch (error) {
    logger.error("Auto attendance follow-up error:", error);
    return NextResponse.json(
      {
        error: "Auto attendance follow-up failed",
        details: "Internal server error",
      },
      { status: 500 },
    );
  }
}
