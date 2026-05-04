import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export type NotificationType = 
  | "grade_posted" 
  | "payment_received" 
  | "attendance_alert" 
  | "fee_due" 
  | "report_card" 
  | "message";

interface CreateNotificationParams {
  schoolId: string;
  parentId: string;
  studentId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

export async function createParentNotification({
  schoolId,
  parentId,
  studentId,
  type,
  title,
  message,
  actionUrl,
}: CreateNotificationParams) {
  try {
    const { data, error } = await supabaseAdmin
      .from("parent_notifications")
      .insert({
        school_id: schoolId,
        parent_id: parentId,
        student_id: studentId,
        type,
        title,
        message,
        action_url: actionUrl,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create parent notification:", error);
      return { success: false, error };
    }

    return { success: true, notification: data };
  } catch (err) {
    logger.error("Notification error:", err);
    return { success: false, error: "Failed to create notification" };
  }
}

export async function notifyGradePosted(schoolId: string, studentId: string, subjectName: string, term: number) {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("parent_id, first_name")
    .eq("id", studentId)
    .single();

  if (!student?.parent_id) return;

  await createParentNotification({
    schoolId,
    parentId: student.parent_id,
    studentId,
    type: "grade_posted",
    title: "New Grade Posted",
    message: `${student.first_name} has a new ${subjectName} grade for Term ${term}. Check the parent portal for details.`,
    actionUrl: "/parent-portal/grades",
  });
}

export async function notifyPaymentReceived(schoolId: string, studentId: string, amount: number, paymentMethod: string) {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("parent_id, first_name")
    .eq("id", studentId)
    .single();

  if (!student?.parent_id) return;

  const formatted = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);

  await createParentNotification({
    schoolId,
    parentId: student.parent_id,
    studentId,
    type: "payment_received",
    title: "Payment Received",
    message: `Payment of ${formatted} received for ${student.first_name}. Thank you!`,
    actionUrl: "/parent-portal/fees",
  });
}

export async function notifyAttendanceAlert(schoolId: string, studentId: string, date: string, status: string) {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("parent_id, first_name")
    .eq("id", studentId)
    .single();

  if (!student?.parent_id) return;

  await createParentNotification({
    schoolId,
    parentId: student.parent_id,
    studentId,
    type: "attendance_alert",
    title: "Attendance Alert",
    message: `${student.first_name} was marked ${status} on ${date}. Please contact the school if this is unexpected.`,
    actionUrl: "/parent-portal/attendance",
  });
}