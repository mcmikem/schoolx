import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, supabaseClientOptions } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "marketer") {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const { email, name, schoolName } = body;

    if (!email || !name) {
      return apiError("Email and name are required", 400);
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return apiError("Email service not configured. Contact support.", 500);
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${request.nextUrl.origin}/dashboard` },
    });

    if (linkError || !linkData) {
      logger.error("[Send Admin Login Link] generateLink error:", linkError);
      return apiError(linkError?.message || "Failed to generate login link. Please try again.", 500);
    }

    const actionLink = linkData.properties?.action_link || "";
    const tokenMatch = actionLink.match(/[?&]token=([^&]+)/);
    const loginUrl = tokenMatch
      ? `${request.nextUrl.origin}/auth/confirm?token=${tokenMatch[1]}&type=magiclink&email=${encodeURIComponent(email)}`
      : actionLink;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "noreply@omuto.org",
        to: [email],
        subject: `Login to ${schoolName || "your school"} on SkoolMate`,
        html: `
          <div style="font-family: system-ui; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">Welcome to SkoolMate!</h2>
            <p>Hi ${name},</p>
            <p>A marketer has created an account for you at <strong>${schoolName || "your school"}</strong>.</p>
            <p>Click the button below to sign in:</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="${loginUrl}"
                 style="background: #1e3a5f; color: white; padding: 12px 32px;
                        text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Sign In to SkoolMate
              </a>
            </p>
            <p style="color: #666; font-size: 13px;">This link expires in 24 hours. If you did not expect this email, you can ignore it.</p>
            <hr style="border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 11px;">Sent by SkoolMate — School Management System</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      logger.error("[Send Admin Login Link] Resend error:", errText);
      return apiError("Failed to send email. Please try again.", 500);
    }

    logger.info(`[Send Admin Login Link] Login link sent to ${email} for ${schoolName || "school"}`);
    return apiSuccess({ sent: true }, `Login link sent to ${email}`);
  } catch (error) {
    logger.error("[Send Admin Login Link] Error:", error);
    return handleApiError(error);
  }
}
