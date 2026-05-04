// src/lib/automation-engine.ts

import { supabase } from "./supabase";
import { logger } from "./logger";
import { sendAfricasTalkingSMS } from "./africas-talking";
import { generateSMSTemplate } from "./sms-automation";

export type AutomationTrigger = 
  | "student_absent"
  | "canteen_balance_low"
  | "fee_payment_received"
  | "grade_published"
  | "discipline_recorded"
  | "system_backup";

export const triggerAutomationEvent = async (
  schoolId: string | undefined, 
  eventName: AutomationTrigger, 
  payload: any
) => {
  if (!schoolId) return;

  try {
    logger.log(`[AUTOMATION ENGINE] Trigger Fired: ${eventName}`, payload);

    if (eventName === "student_absent") {
      const { data: student } = await supabase
        .from("students")
        .select("first_name, last_name, parent_phone, parent_name")
        .eq("id", payload.student_id)
        .eq("school_id", schoolId)
        .single();

      if (student?.parent_phone) {
        const message = generateSMSTemplate("absentee_alert", {
          student_name: `${student.first_name} ${student.last_name}`,
          parent_name: student.parent_name,
          school_name: "School",
        });

        const smsResult = await sendAfricasTalkingSMS(student.parent_phone, message, {
          formatUgandaNumber: true,
        });

        if (smsResult.success) {
          await supabase.from("sms_logs").insert({
            school_id: schoolId,
            automation_type: "absentee_alert",
            student_id: payload.student_id,
            parent_phone: student.parent_phone,
            message,
            status: smsResult.demo ? "demo" : "sent",
            metadata: { date: payload.date || new Date().toISOString().split("T")[0] },
            sent_at: new Date().toISOString(),
          });
          logger.log(`[AUTOMATION] Absence SMS sent to ${student.parent_phone}`);
        } else {
          logger.error(`[AUTOMATION] Absence SMS failed: ${smsResult.error}`);
        }
      }
    }

    if (eventName === "fee_payment_received") {
      logger.log(`Payment confirmed: ${payload.amount_paid}. Syncing...`);
    }
  } catch (err) {
    logger.error("Automation error:", err);
  }
};
