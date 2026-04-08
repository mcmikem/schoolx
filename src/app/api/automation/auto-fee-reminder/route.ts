import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny } from "@/lib/api-utils";

// Auto Fee Reminder SMS Scheduler
// Automatically sends SMS reminders to parents with outstanding fees
// based on configurable triggers (7, 14, 30 days overdue)

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { schoolId, triggers } = await request.json();

    if (!schoolId) {
      return NextResponse.json(
        { error: "Missing required parameter: schoolId" },
        { status: 400 },
      );
    }

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

    // Get all students with outstanding fees
    const { data: studentsWithFees, error: studentsError } = await supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        parent_phone,
        classes (name),
        fee_balances (
          balance,
          due_date,
          last_reminder_sent
        )
      `,
      )
      .eq("school_id", schoolId)
      .eq("status", "active");

    if (studentsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch students with fees",
          details: studentsError.message,
        },
        { status: 500 },
      );
    }

    const results: {
      remindersSent: any[];
      skipped: any[];
      errors: any[];
    } = {
      remindersSent: [],
      skipped: [],
      errors: [],
    };

    const now = new Date();

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

        const feeBalance = student.fee_balances?.[0];
        if (!feeBalance || feeBalance.balance <= 0) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: "No outstanding balance",
          });
          continue;
        }

        // Calculate days overdue
        const dueDate = new Date(feeBalance.due_date);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysOverdue < 0) {
          results.skipped.push({
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            reason: `Not yet due (${Math.abs(daysOverdue)} days remaining)`,
          });
          continue;
        }

        // Check which triggers apply
        for (const trigger of reminderTriggers) {
          if (daysOverdue >= trigger.days) {
            // Check if reminder was already sent for this trigger
            const lastReminder = feeBalance.last_reminder_sent
              ? new Date(feeBalance.last_reminder_sent)
              : null;

            const daysSinceLastReminder = lastReminder
              ? Math.floor(
                  (now.getTime() - lastReminder.getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : 999;

            // Only send if we haven't sent this reminder recently (within trigger days)
            if (daysSinceLastReminder >= trigger.days) {
              // Format the message with variables
              const message = trigger.message
                .replace(
                  "{student_name}",
                  `${student.first_name} ${student.last_name}`,
                )
                .replace("{balance}", feeBalance.balance.toLocaleString())
                .replace("{due_date}", dueDate.toLocaleDateString())
                .replace("{class}", student.classes?.name || "Unknown");

              // Send SMS via Africa's Talking or similar provider
              const smsResult = await sendSMS(student.parent_phone, message);

              if (smsResult.success) {
                // Update last reminder sent
                await supabase
                  .from("fee_balances")
                  .update({ last_reminder_sent: now.toISOString() })
                  .eq("id", feeBalance.id);

                // Log the SMS
                await supabase.from("messages").insert({
                  school_id: schoolId,
                  recipient: student.parent_phone,
                  message: message,
                  status: "sent",
                  sent_at: now.toISOString(),
                  type: "fee_reminder",
                  student_id: student.id,
                });

                results.remindersSent.push({
                  studentId: student.id,
                  name: `${student.first_name} ${student.last_name}`,
                  phone: student.parent_phone,
                  balance: feeBalance.balance,
                  daysOverdue,
                  triggerDays: trigger.days,
                  messageId: smsResult.messageId,
                });
              } else {
                results.errors.push({
                  studentId: student.id,
                  name: `${student.first_name} ${student.last_name}`,
                  reason: `SMS failed: ${smsResult.error}`,
                });
              }
            }
          }
        }
      } catch (err) {
        results.errors.push({
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          reason: err instanceof Error ? err.message : "Unknown error",
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
    console.error("Auto fee reminder error:", error);
    return NextResponse.json(
      {
        error: "Auto fee reminder failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Helper function to send SMS
async function sendSMS(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Use Africa's Talking API or your SMS provider
    const apiKey = process.env.SMS_API_KEY;
    const username = process.env.SMS_USERNAME || "sandbox";

    if (!apiKey) {
      // In development mode, just log
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
