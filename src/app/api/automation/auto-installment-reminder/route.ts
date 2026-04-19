import { NextRequest, NextResponse } from "next/server";
import { detectInstallmentReminders } from "@/lib/operations";
import { logger } from "@/lib/logger";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";
import { sendAfricasTalkingSMS } from "@/lib/africas-talking";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabase = createServiceRoleClientOrThrow();

    const { schoolId, daysNotice } = await request.json();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    // 1. Get all active payment plans for this school
    const plansQuery = await supabase
      .from("payment_plans")
      .select("*")
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    const plans: any[] = (plansQuery.data || []) as any[];

    if (plans.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active plans found",
      });
    }

    // 2. Get installments and students
    const planIds = plans.map((p: any) => p.id);
    const { data: installments } = await supabase
      .from("payment_plan_installments")
      .select("*")
      .in("plan_id", planIds)
      .eq("paid", false);

    const studentIds = Array.from(new Set(plans.map((p) => p.student_id)));
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, parent_phone")
      .in("id", studentIds);

    // 3. Detect reminders using lib
    const reminders = detectInstallmentReminders({
      plans,
      installments: installments || [],
      students: students || [],
      daysNotice: daysNotice || 1,
    });

    const results = { sent: 0, skipped: 0, errors: 0 };

    for (const reminder of reminders) {
      if (!reminder.parentPhone) {
        results.skipped++;
        continue;
      }

      // Send SMS
      try {
        const smsRes = await sendAfricasTalkingSMS(
          reminder.parentPhone,
          reminder.smsMessage,
          { formatUgandaNumber: true },
        );
        if (smsRes.success) {
          // Log success
          await (supabase as any).from("automated_message_logs").insert({
            school_id: school.schoolId,
            trigger_id: "auto-installment-reminder",
            recipient_id: reminder.parentPhone,
            record_id: reminder.planId,
            status: "sent",
          });
          results.sent++;
        } else {
          results.errors++;
        }
      } catch {
        results.errors++;
      }
    }

    return NextResponse.json({ success: true, summary: results });
  } catch (error) {
    logger.error("Installment reminder error", { error });
    return NextResponse.json({ error: "Automation failed" }, { status: 500 });
  }
}

