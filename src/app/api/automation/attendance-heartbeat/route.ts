import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { schoolId } = await request.json();

    if (!schoolId) {
      return NextResponse.json({ error: "Missing schoolId" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    // 1. Get all classes
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, teacher_id")
      .eq("school_id", schoolId)
      .eq("status", "active");

    if (!classes || classes.length === 0) return NextResponse.json({ success: true, message: "No classes" });

    // 2. Get attendance marked today
    const { data: attendance } = await supabase
      .from("attendance")
      .select("class_id")
      .eq("date", today);

    const markedClassIds = new Set((attendance || []).map(a => a.class_id));
    const unmarkedClasses = classes.filter(c => !markedClassIds.has(c.id));

    const results = { nudgesSent: 0, errors: 0 };

    for (const cls of unmarkedClasses) {
      if (!cls.teacher_id) continue;

      // Get teacher phone
      const { data: teacher } = await supabase
        .from("users")
        .select("full_name, phone")
        .eq("id", cls.teacher_id)
        .single();

      if (teacher?.phone) {
        const message = `Friendly Nudge: Attendance for ${cls.name} hasn't been marked yet. Please update the system as soon as possible. - SkoolMate Admin`;
        
        try {
          const smsRes = await sendSMS(teacher.phone, message);
          if (smsRes.success) {
            results.nudgesSent++;
            await supabase.from("automated_message_logs").insert({
               school_id: schoolId,
               trigger_id: "attendance-heartbeat",
               recipient_id: teacher.phone,
               record_id: cls.id,
               status: "sent"
            });
          }
        } catch {
          results.errors++;
        }
      }
    }

    return NextResponse.json({ success: true, summary: results, unmarked: unmarkedClasses.map(c => c.name) });
  } catch (error) {
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}

async function sendSMS(phone: string, message: string) {
  const apiKey = process.env.SMS_API_KEY;
  const username = process.env.SMS_USERNAME || "sandbox";
  if (!apiKey) return { success: true };
  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", apikey: apiKey },
    body: new URLSearchParams({ username, to: phone, message })
  });
  return { success: response.ok };
}
