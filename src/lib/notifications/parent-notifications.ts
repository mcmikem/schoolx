import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

let supabaseAdminClient: any = null;

function getSupabaseAdminClient() {
  if (supabaseAdminClient) return supabaseAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error("Parent notifications disabled: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }

  supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdminClient;
}

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
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return { success: false, error: "Supabase service is not configured" };
    }

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

export async function getParentIdsForStudent(supabaseAdmin: any, studentId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("parent_students").select("parent_id").eq("student_id", studentId);

  return (data || []).map((row: { parent_id: string }) => row.parent_id);
}

export async function notifyGradePosted(schoolId: string, studentId: string, subjectName: string, term: number) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return;

  const { data: student } = await supabaseAdmin.from("students").select("first_name").eq("id", studentId).single();

  const parentIds = await getParentIdsForStudent(supabaseAdmin, studentId);
  if (!parentIds.length) return;

  for (const parentId of parentIds) {
    await createParentNotification({
      schoolId,
      parentId,
      studentId,
      type: "grade_posted",
      title: "New Grade Posted",
      message: `${student?.first_name || "Your child"} has a new ${subjectName} grade for Term ${term}. Check the parent portal for details.`,
      actionUrl: "/parent-portal/grades",
    });
  }
}

export async function notifyPaymentReceived(
  schoolId: string,
  studentId: string,
  amount: number,
  paymentMethod: string,
) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return;

  const { data: student } = await supabaseAdmin.from("students").select("first_name").eq("id", studentId).single();

  const parentIds = await getParentIdsForStudent(supabaseAdmin, studentId);
  if (!parentIds.length) return;

  const formatted = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);

  for (const parentId of parentIds) {
    await createParentNotification({
      schoolId,
      parentId,
      studentId,
      type: "payment_received",
      title: "Payment Received",
      message: `Payment of ${formatted} received for ${student?.first_name || "your child"}. Thank you!`,
      actionUrl: "/parent-portal/fees",
    });
  }
}

export async function notifyAttendanceAlert(schoolId: string, studentId: string, date: string, status: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return;

  const { data: student } = await supabaseAdmin.from("students").select("first_name").eq("id", studentId).single();

  const parentIds = await getParentIdsForStudent(supabaseAdmin, studentId);
  if (!parentIds.length) return;

  for (const parentId of parentIds) {
    await createParentNotification({
      schoolId,
      parentId,
      studentId,
      type: "attendance_alert",
      title: "Attendance Alert",
      message: `${student?.first_name || "Your child"} was marked ${status} on ${date}. Please contact the school if this is unexpected.`,
      actionUrl: "/parent-portal/attendance",
    });
  }
}
