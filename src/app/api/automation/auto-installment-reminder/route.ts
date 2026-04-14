import { NextRequest, NextResponse } from "next/server";
import { detectInstallmentReminders } from "@/lib/operations";
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

    const { schoolId, daysNotice } = await request.json();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    // 1. Get all active payment plans for this school
    const { data: plans }: { data: any[] } = await supabase
      .from("payment_plans")
      .select("*")
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (!plans || plans.length === 0) {
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
        const smsRes = await sendSMS(reminder.parentPhone, reminder.smsMessage);
        if (smsRes.success) {
          // Log success
          await supabase.from("automated_message_logs").insert({
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
    console.error("Installment reminder error:", error);
    return NextResponse.json({ error: "Automation failed" }, { status: 500 });
  }
}

async function sendSMS(phone: string, message: string) {
  const apiKey = process.env.SMS_API_KEY;
  const username = process.env.SMS_USERNAME || "sandbox";

  if (!apiKey) {
    console.log(`[DRY RUN SMS] To: ${phone}, Msg: ${message}`);
    return { success: true };
  }

  const response = await fetch(
    "https://api.africastalking.com/version1/messaging",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apikye: apiKey,
      },
      body: new URLSearchParams({ username, to: phone, message }),
    },
  );

  return { success: response.ok };
}
