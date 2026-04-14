import { NextRequest, NextResponse } from "next/server";
import {
  detectConsecutiveAbsenceAlerts,
  filterAbsenceAlertsForCooldown,
} from "@/lib/operations";
import type { AttendanceAlert } from "@/lib/operations";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabase = createServiceRoleClientOrThrow();

    const { schoolId, threshold } = await request.json();
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
        { error: "Failed to fetch students", details: studentsError.message },
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

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
          details: attendanceError.message,
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
      .select("trigger_id, record_id, status, sent_at, created_at")
      .eq("school_id", school.schoolId)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );

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
      const shouldSend = alertsToSend.some(
        (a) => a.studentId === alert.studentId,
      );

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
        const smsResult = await sendSMS(alert.parentPhone, alert.smsMessage);

        if (smsResult.success) {
          // Log the message
          await supabase.from("messages").insert({
            school_id: school.schoolId,
            recipient_type: "individual",
            recipient_id: alert.studentId,
            phone: alert.parentPhone,
            message: alert.smsMessage,
            status: "sent",
            sent_at: sentAt,
            type: "attendance_followup",
          });

          // Log the automated message
          await supabase.from("automated_message_logs").insert({
            school_id: school.schoolId,
            trigger_id: "auto-attendance-followup",
            recipient_id: alert.parentPhone,
            record_id: alert.studentId,
            status: "sent",
            sent_at: sentAt,
          });

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
          reason: err instanceof Error ? err.message : "Unknown error",
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
    console.error("Auto attendance follow-up error:", error);
    return NextResponse.json(
      {
        error: "Auto attendance follow-up failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function sendSMS(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.SMS_API_KEY;
    const username = process.env.SMS_USERNAME || "sandbox";

    if (!apiKey) {
      console.log(`[SMS] To: ${phone}, Message: ${message}`);
      return { success: true, messageId: "dev-mode" };
    }

    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apikey: apiKey,
        },
        body: new URLSearchParams({
          username,
          to: phone,
          message,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    const messageId = data.SMSMessageData?.Recipients?.[0]?.messageId;

    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
