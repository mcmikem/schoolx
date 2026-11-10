import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseClientOptions } from "@/lib/api-utils";
import { createHmac, timingSafeEqual } from "crypto";
import { buildPhoneLookupCandidates } from "@/lib/auth-phone";
import { normalizeAuthPhone } from "@/lib/validation";

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

  const sha256Hex = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const sha256Base64 = createHmac("sha256", webhookSecret).update(rawBody).digest("base64");
  const sha1Hex = createHmac("sha1", webhookSecret).update(rawBody).digest("hex");
  const sha1Base64 = createHmac("sha1", webhookSecret).update(rawBody).digest("base64");

  return [sha256Hex, sha256Base64, sha1Hex, sha1Base64].some((candidate) => safeEqualString(candidate, normalized));
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    supabaseClientOptions({
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}

export async function POST(request: NextRequest) {
  try {
    // Africa's Talking sends payload as application/x-www-form-urlencoded.
    const rawBody = await request.text();
    if (rawBody.length > 20_000) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const signatureHeader =
      request.headers.get("x-africastalking-signature") || request.headers.get("x-signature") || "";

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

    if (!from || from.length > 32 || !message || message.length > 1600) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      logger.error("Incoming SMS webhook rejected: missing Supabase service configuration");
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }

    const normalizedPhone = normalizeAuthPhone(from);
    const phoneCandidates = Array.from(
      new Set(
        [
          ...buildPhoneLookupCandidates(from),
          ...buildPhoneLookupCandidates(normalizedPhone),
          normalizedPhone ? `+${normalizedPhone}` : "",
          from.trim(),
        ].filter(Boolean),
      ),
    );
    if (phoneCandidates.length === 0) return NextResponse.json({ status: "OK" });

    // Use parameterized `in` filters for sender-controlled values. Search both
    // contacts and deduplicate a learner whose two guardian numbers match.
    const [primaryMatches, secondaryMatches] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, first_name, last_name, school_id")
        .in("parent_phone", phoneCandidates)
        .limit(100),
      supabaseAdmin
        .from("students")
        .select("id, first_name, last_name, school_id")
        .in("parent_phone2", phoneCandidates)
        .limit(100),
    ]);
    if (primaryMatches.error || secondaryMatches.error) {
      logger.error("Incoming SMS contact lookup failed", {
        primary: primaryMatches.error?.code,
        secondary: secondaryMatches.error?.code,
      });
      return NextResponse.json({ error: "Unable to route this message" }, { status: 500 });
    }
    const students = Array.from(
      new Map(
        [...(primaryMatches.data || []), ...(secondaryMatches.data || [])].map((student) => [student.id, student]),
      ).values(),
    );
    if (students.length === 0) {
      logger.info(`Incoming SMS from phone ending ${normalizedPhone.slice(-4)} did not match a learner`);
      return NextResponse.json({ status: "OK" });
    }

    const schoolIds = new Set(students.map((student) => student.school_id).filter(Boolean));
    // A phone can be shared by families and schools. Without a school code in
    // the SMS, never reveal the message to an arbitrary school's staff.
    if (schoolIds.size !== 1) {
      logger.warn(`Incoming SMS from phone ending ${normalizedPhone.slice(-4)} matched multiple schools; not routed`);
      return NextResponse.json({ status: "OK" });
    }
    logger.info(
      `Incoming SMS routed to ${students.length} learner record(s); phone ending ${normalizedPhone.slice(-4)}`,
    );

    const sentAtCandidate = date ? new Date(date) : new Date();
    const sentAt = Number.isNaN(sentAtCandidate.getTime()) ? new Date().toISOString() : sentAtCandidate.toISOString();
    const smsRows = students.map((student) => ({
      school_id: student.school_id,
      student_id: student.id,
      parent_phone: normalizedPhone,
      message,
      status: "pending",
      sent_at: sentAt,
    }));
    const { error: logError } = await supabaseAdmin.from("sms_logs").insert(smsRows);

    if (logError) {
      logger.error("Failed to log incoming SMS:", logError);
      return NextResponse.json({ error: "Unable to store this message" }, { status: 500 });
    }

    // Create a notification for the school
    try {
      await supabaseAdmin.from("parent_notifications").insert(
        students.map((student) => ({
          school_id: student.school_id,
          parent_id: null,
          student_id: student.id,
          type: "message",
          title: "Parent Reply",
          message: `Parent of ${student.first_name} replied: ${message.substring(0, 100)}`,
          action_url: `/dashboard/messages?from=${student.id}`,
        })),
      );
    } catch (notifError) {
      logger.warn("Failed to create parent notification (table may not exist):", notifError);
    }

    // Auto-reply with confirmation
    const autoReply = `Thank you for your message. The school has received your response.`;

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${autoReply}</Message>
</Response>`,
      {
        headers: { "Content-Type": "application/xml" },
      },
    );
  } catch (error) {
    logger.error("Incoming SMS webhook error:", error);
    return NextResponse.json({ status: "error", message: "Internal server error" }, { status: 500 });
  }
}
