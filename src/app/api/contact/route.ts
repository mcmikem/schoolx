import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return apiError("Too many requests. Please try again later.", 429);
    }

    const body = await request.json();
    const { type, name, email, phone, school, message, student_count, _website } = body;

    if (_website) {
      return apiSuccess(null, "Message sent", 200);
    }

    if (!name || !email || !message) {
      return apiError("Name, email, and message are required", 400);
    }

    if (!email.includes("@")) {
      return apiError("Invalid email address", 400);
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      logger.error("Resend API key not configured — contact form message NOT delivered");
      return apiError("Message delivery is not configured on the server. Please contact the school directly.", 503);
    }

    const subject =
      type === "demo"
        ? `Demo request from ${escapeHtml(name)} — ${escapeHtml(school || email)}`
        : `Contact form message from ${escapeHtml(name)} — ${escapeHtml(school || email)}`;

    const fields: [string, string][] = [
      ["Type", type === "demo" ? "Demo Request" : "Contact Inquiry"],
      ["Name", escapeHtml(name)],
      ["Email", escapeHtml(email)],
      ["Phone", escapeHtml(phone || "—")],
      ["School", escapeHtml(school || "—")],
    ];

    if (type === "demo" && student_count) {
      fields.push(["Students", escapeHtml(String(student_count))]);
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #001F3F;">${escapeHtml(subject)}</h2>
        <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
          ${fields
            .map(
              ([label, value]) => `
            <tr>
              <td style="padding:8px 12px; border-bottom:1px solid #eee; font-weight:600; color:#333; width:100px;">${label}</td>
              <td style="padding:8px 12px; border-bottom:1px solid #eee; color:#555;">${value}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-weight:600; color:#333; vertical-align:top;">Message</td>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; color:#555; white-space:pre-wrap;">${escapeHtml(message)}</td>
          </tr>
        </table>
        <hr style="border:none; border-top:1px solid #eee;">
        <p style="color:#999; font-size:11px;">Sent from SkoolMate OS contact form</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "noreply@omuto.org",
        to: ["os@omuto.org"],
        replyTo: email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      logger.error("Resend contact form error:", text);
      return apiError("Failed to send message. Please try again later.", 500);
    }

    return apiSuccess(null, "Message sent successfully! We'll respond within 24 hours.", 200);
  } catch (error) {
    logger.error("POST /api/contact error:", error);
    return handleApiError(error);
  }
}
