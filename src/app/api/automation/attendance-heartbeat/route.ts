import { NextRequest, NextResponse } from "next/server";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    // @ts-ignore - Supabase type inference issue with service role client
    const supabase = createServiceRoleClientOrThrow();

    const { schoolId } = await request.json();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    const today = new Date().toISOString().split("T")[0];

    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, teacher_id")
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    const classList = (classes || []) as {
      id: string;
      name: string;
      teacher_id: string | null;
    }[];

    if (classList.length === 0)
      return NextResponse.json({ success: true, message: "No classes" });

    const { data: attendance } = await supabase
      .from("attendance")
      .select("class_id")
      .eq("date", today);

    const markedClassIds = new Set(
      (attendance || []).map((a: any) => a.class_id),
    );
    const unmarkedClasses = classList.filter((c) => !markedClassIds.has(c.id));

    const results = { nudgesSent: 0, errors: 0 };

    for (const cls of unmarkedClasses) {
      if (!cls.teacher_id) continue;

      const { data: teacher } = await supabase
        .from("users")
        .select("full_name, phone")
        .eq("id", cls.teacher_id)
        .single();

      const teacherUser = teacher as any;
      if (teacherUser?.phone) {
        const message = `Friendly Nudge: Attendance for ${cls.name} hasn't been marked yet. Please update the system as soon as possible. - SkoolMate Admin`;

        try {
          const smsRes = await sendSMS(teacherUser.phone, message);
          if (smsRes.success) {
            results.nudgesSent++;
            await supabase.from("automated_message_logs").insert({
              school_id: school.schoolId,
              trigger_id: "attendance-heartbeat",
              recipient_id: teacher.phone,
              record_id: cls.id,
              status: "sent",
            } as any);
          }
        } catch {
          results.errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: results,
      unmarked: unmarkedClasses.map((c: any) => c.name),
    });
  } catch (error) {
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}

async function sendSMS(phone: string, message: string) {
  const apiKey = process.env.SMS_API_KEY;
  const username = process.env.SMS_USERNAME || "sandbox";
  if (!apiKey) return { success: true };
  const response = await fetch(
    "https://api.africastalking.com/version1/messaging",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey,
        username,
      },
      body: JSON.stringify({
        to: [phone],
        message,
      }),
    },
  );
  const data = await response.json();
  return { success: response.ok, data };
}
