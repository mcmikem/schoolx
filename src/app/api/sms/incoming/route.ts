import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface IncomingSMS {
  from: string;
  to: string;
  message: string;
  date: string;
}

export async function POST(request: NextRequest) {
  try {
    // Africa's Talking sends data as form-urlencoded, not JSON
    const formData = await request.formData();
    
    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    const message = (formData.get("message") || formData.get("text")) as string;
    const date = formData.get("date") as string;

    if (!from || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    logger.info(`Incoming SMS from ${from}: ${message}`);

    // Normalize phone number
    const normalizedPhone = from.replace(/^256/, "0").replace(/^\+256/, "0");

    // Find the student by parent phone
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, school_id, parent_phone")
      .or(`parent_phone.eq.${normalizedPhone},parent_phone.eq.${from}`)
      .single();

    if (!student) {
      logger.warn(`No student found for phone: ${from}`);
      return NextResponse.json({ status: "OK" });
    }

    // Store the incoming SMS
    const { data: smsLog, error: logError } = await supabaseAdmin
      .from("sms_logs")
      .insert({
        school_id: student.school_id,
        student_id: student.id,
        phone: from,
        message: message,
        status: "received",
        sent_at: new Date(date || new Date().toISOString()).toISOString(),
      })
      .select()
      .single();

    if (logError) {
      logger.error("Failed to log incoming SMS:", logError);
    }

    // Create a notification for the school
    await supabaseAdmin
      .from("parent_notifications")
      .insert({
        school_id: student.school_id,
        parent_id: null, // No user for incoming SMS
        student_id: student.id,
        type: "message",
        title: "Parent Reply",
        message: `Parent of ${student.first_name} replied: ${message.substring(0, 100)}`,
        action_url: `/dashboard/messages?from=${student.id}`,
      });

    // Auto-reply with confirmation
    const autoReply = `Thank you for your message. The school has received your response.`;
    
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${autoReply}</Message>
</Response>`, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (error) {
    logger.error("Incoming SMS webhook error:", error);
    return NextResponse.json({ status: "OK" });
  }
}