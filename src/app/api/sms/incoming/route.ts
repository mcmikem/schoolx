import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";

const webhookSecret = process.env.AFRICAS_TALKING_WEBHOOK_SECRET || "";

interface IncomingSMS {
  from: string;
  to: string;
  message: string;
  date: string;
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function hasValidWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const normalized = signatureHeader.trim();
  if (!normalized) return false;

  const sha256Hex = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  const sha256Base64 = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("base64");
  const sha1Hex = createHmac("sha1", webhookSecret).update(rawBody).digest("hex");
  const sha1Base64 = createHmac("sha1", webhookSecret)
    .update(rawBody)
    .digest("base64");

  return [sha256Hex, sha256Base64, sha1Hex, sha1Base64].some((candidate) =>
    safeEqualString(candidate, normalized),
  );
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Africa's Talking sends payload as application/x-www-form-urlencoded.
    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("x-africastalking-signature") ||
      request.headers.get("x-signature") ||
      "";

    if (!webhookSecret) {
      if (process.env.NODE_ENV !== "development") {
        logger.error("Incoming SMS webhook rejected: missing AFRICAS_TALKING_WEBHOOK_SECRET");
        return NextResponse.json({ error: "Webhook security not configured" }, { status: 503 });
      }
      logger.warn("Incoming SMS webhook running without signature validation in development");
    } else if (!signatureHeader || !hasValidWebhookSignature(rawBody, signatureHeader)) {
      logger.warn("Incoming SMS webhook rejected: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const formData = new URLSearchParams(rawBody);
    const from = formData.get("from") || "";
    const to = formData.get("to") || "";
    const message = formData.get("message") || formData.get("text") || "";
    const date = formData.get("date") || "";

    if (!from || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      logger.error("Incoming SMS webhook rejected: missing Supabase service configuration");
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
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