import { NextRequest, NextResponse } from "next/server";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { sendToParent } from "@/lib/messaging-server";
import { logger } from "@/lib/logger";

// Auto Fee Reminder SMS Scheduler
// Automatically sends SMS reminders to parents with outstanding fees
// based on configurable triggers (7, 14, 30 days overdue)
//
// Auth: Vercel cron via x-cron-secret header, OR an authenticated staff
// session (school_admin/admin/headmaster/bursar) scoped to their own school.
// The dashboard "Auto Fee Reminders" button uses the session path — cron-only
// auth made every dashboard click fail with 401.

const DASHBOARD_REMINDER_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    const { schoolId: requestedSchoolId, triggers } = await request.json();

    if (!cron.ok) {
      // Dashboard fallback: authenticated school staff may trigger manually.
      // Any failure here (no session, bad scope/role, auth backend error)
      // defers to the cron denial so the security gate behaves exactly as
      // before for unauthenticated callers.
      try {
        const auth = await requireUserWithSchool(request);
        if (!auth.ok) return cron.response;

        const scope = assertSchoolScopeOrDeny({
          userSchoolId: auth.context.schoolId,
          requestedSchoolId,
        });
        if (!scope.ok) return scope.response;

        const roleCheck = assertUserRoleOrDeny({
          userRole: auth.context.user.role,
          allowedRoles: DASHBOARD_REMINDER_ROLES,
        });
        if (!roleCheck.ok) return roleCheck.response;
      } catch {
        return cron.response;
      }
    }
    const supabase = createServiceRoleClientOrThrow();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId: requestedSchoolId });
    if (!school.ok) return school.response;

    const subCheck = await requireActiveSubscription({
      supabase,
      schoolId: school.schoolId,
      requiredPlan: "starter",
    });
    if (!subCheck.ok) return subCheck.response;

    // Default triggers (days overdue)
    const reminderTriggers = triggers || [
      {
        days: 7,
        message:
          "Dear parent, your child {student_name} has outstanding fees of UGX {balance}. Please pay by {due_date}. Thank you.",
      },
      {
        days: 14,
        message:
          "URGENT: Your child {student_name} has unpaid fees of UGX {balance}. Payment is now 2 weeks overdue. Please settle immediately.",
      },
      {
        days: 30,
        message:
          "FINAL NOTICE: Your child {student_name} has unpaid fees of UGX {balance}. Payment is 1 month overdue. Please contact the school office.",
      },
    ];

    // Get all active students with their class info and parent phone
    const { data: studentsWithFees, error: studentsError } = await supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        parent_phone,
        class_id,
        classes (name)
      `,
      )
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (studentsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch students with fees",
          details: "Internal server error",
        },
        { status: 500 },
      );
    }

    // Fetch fee structure and payments to calculate balances
    const { data: feeStructure } = await supabase
      .from("fee_structure")
      .select("id, class_id, amount, due_date")
      .eq("school_id", school.schoolId);

    const { data: feePayments } = await supabase
      .from("fee_payments")
      .select("student_id, amount_paid")
      .in(
        "student_id",
        (studentsWithFees || []).map((s: any) => s.id),
      );

    // Build payment totals per student
    const paymentsByStudent = new Map<string, number>();
    for (const p of feePayments || []) {
      paymentsByStudent.set(p.student_id, (paymentsByStudent.get(p.student_id) || 0) + Number(p.amount_paid || 0));
    }

    const now = new Date();

    const results = {
      remindersSent: [] as {
        studentId: string;
        name: string;
        phone: string;
        balance: number;
        daysOverdue: number;
        triggerDays: number;
        messageId?: string;
      }[],
      skipped: [] as { studentId: string; name: string; reason: string }[],
      errors: [] as { studentId: string; name: string; error?: string; reason?: string }[],
    };

    for (const student of studentsWithFees as any[]) {
      try {
        if (!student.parent_phone) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: "No parent phone number",
          });
          continue;
        }

        // Calculate balance: total fees for student's class minus payments
        const classFees = (feeStructure || []).filter((f: any) => !f.class_id || f.class_id === student.class_id);
        const totalExpected = classFees.reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
        const totalPaid = paymentsByStudent.get(student.id) || 0;
        const balance = totalExpected - totalPaid;
        const earliestDueDate =
          classFees
            .filter((f: any) => f.due_date)
            .map((f: any) => new Date(f.due_date))
            .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0] || now;

        if (balance <= 0) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: "No outstanding balance",
          });
          continue;
        }

        // Calculate days overdue
        const dueDate = earliestDueDate;
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue < 0) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: `Not yet due (${Math.abs(daysOverdue)} days remaining)`,
          });
          continue;
        }

        // Check which triggers apply (only send the highest applicable trigger not yet sent)
        const applicableTriggers = (reminderTriggers as Array<{ days: number; message: string }>)
          .filter((t: { days: number }) => daysOverdue >= t.days)
          .sort((a: { days: number }, b: { days: number }) => b.days - a.days);

        if (applicableTriggers.length === 0) continue;

        // Check if we already sent a reminder to this phone number
        const { withTimeout: wt, timeoutFallback: tf } = await import("@/lib/hooks/utils");
        const { data: priorReminders } = await wt(
          supabase
            .from("messages")
            .select("created_at")
            .eq("phone", student.parent_phone)
            .order("created_at", { ascending: false })
            .limit(1),
          15000,
          tf(),
        );

        const lastReminderDate = priorReminders?.[0]?.created_at ? new Date(priorReminders[0].created_at) : null;

        const highestTrigger = applicableTriggers[0];
        const alreadySentAtThisLevel = lastReminderDate
          ? Math.floor((now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24)) < highestTrigger.days
          : false;

        if (alreadySentAtThisLevel) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: `Reminder already sent within ${highestTrigger.days}-day window`,
          });
          continue;
        }

        // NOTE: daily quota is enforced inside sendSchoolMessage, and only
        // when the resolved channel is actually SMS. Checking it here would
        // wrongly block WhatsApp sends once a school switches channels.
        const message = highestTrigger.message
          .replace("{student_name}", `${student.first_name} ${student.last_name}`)
          .replace("{balance}", balance.toLocaleString())
          .replace("{due_date}", dueDate.toLocaleDateString())
          .replace("{class}", student.classes?.name || "Unknown");

        const smsResult = await sendToParent(supabase, {
          schoolId: school.schoolId,
          to: student.parent_phone,
          message,
          kind: "fee_reminder",
        });

        if (smsResult.success) {
          const { withTimeout, timeoutFallback } = await import("@/lib/hooks/utils");
          const feeMsgResult = await withTimeout(
            supabase.from("messages").insert({
              school_id: school.schoolId,
              phone: student.parent_phone,
              recipient_type: "individual",
              recipient_id: student.id,
              message: message,
              status: "sent",
              sent_at: now.toISOString(),
            } as any),
            15000,
            timeoutFallback(),
          );
          if (feeMsgResult?.error) {
            logger.error("Fee reminder message insert error:", feeMsgResult.error);
          }

          results.remindersSent.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            phone: student.parent_phone,
            balance: balance,
            daysOverdue,
            triggerDays: highestTrigger.days,
            messageId: smsResult.messageId,
          });
        } else {
          results.errors.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: `${smsResult.channel === "whatsapp" ? "WhatsApp" : "SMS"} failed: ${smsResult.error}`,
          });
        }
      } catch (err) {
        results.errors.push({
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          reason: "Fee reminder processing failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: studentsWithFees.length,
        remindersSent: results.remindersSent.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      results,
    });
  } catch (error) {
    logger.error("Auto fee reminder error:", error);
    return NextResponse.json(
      {
        error: "Auto fee reminder failed",
        details: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// Helper function to send SMS
