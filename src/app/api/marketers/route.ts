import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { normalizeAuthPhone } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { buildAuthEmailFromPhone } from "@/lib/auth-login";

const DEFAULT_PASSWORD = "Omutofoundation";

const isEmailConfigured = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

async function requireSuperAdmin(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      response: apiError("Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local", 500),
    };
  }

  const supabase = createServiceRoleClientOrThrow();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", auth.context.authUserId)
    .maybeSingle();

  if (!profile || profile.role !== "super_admin") {
    return { ok: false as const, response: apiError("Forbidden", 403) };
  }

  return { ok: true as const };
}

function checkServiceConfig(): { ok: true } | { ok: false; response: NextResponse } {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      response: apiError(
        "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Add it to your .env.local file (get it from Supabase Dashboard → Settings → API → service_role key).",
        500,
      ),
    };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  try {
    const config = checkServiceConfig();
    if (!config.ok) return config.response;
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data: marketers, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email, is_active, created_at")
      .eq("role", "marketer")
      .order("created_at", { ascending: false });

    if (error) {
      return apiError("Failed to fetch marketers", 500);
    }

    return apiSuccess(marketers);
  } catch (error) {
    logger.error("GET /api/marketers error:", error);
    return handleApiError(error);
  }
}

async function sendLoginLinkEmail(
  to: string,
  loginLink: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: "Resend API key not configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "noreply@omuto.org",
        to: [to],
        subject: "Your Marketer Account – Login Link",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #001F3F;">Welcome, ${name}!</h2>
            <p>Your SkoolMate marketer account has been created.</p>
            <p>Click the button below to log in:</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="${loginLink}"
                 style="background: #001F3F; color: white; padding: 12px 32px;
                        text-decoration: none; border-radius: 8px; font-weight: bold;">
                Log in to SkoolMate
              </a>
            </p>
            <p style="color: #666; font-size: 13px;">This link expires in 1 hour.</p>
            <hr style="border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 11px;">Sent by SkoolMate — School Management System</p>
          </div>
        `,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "unknown error");
      return { success: false, error: body };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = checkServiceConfig();
    if (!config.ok) return config.response;
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const emailRaw = ((body.email as string) || "").trim().toLowerCase();
    const phoneRaw = ((body.phone as string) || "").trim();
    const fullName = ((body.full_name as string) || "").trim();

    if (!emailRaw && !phoneRaw) {
      return apiError("Either email or phone is required", 400);
    }

    const name = fullName || (emailRaw ? emailRaw.split("@")[0] : phoneRaw);

    const supabase = createServiceRoleClientOrThrow();

    // ── Determine auth email ──────────────────────────────────────────────
    let authEmail: string;
    let useEmailFlow: boolean;

    if (emailRaw) {
      if (!emailRaw.includes("@")) {
        return apiError("Invalid email address", 400);
      }
      authEmail = emailRaw;
      useEmailFlow = isEmailConfigured;
    } else {
      const normalized = normalizeAuthPhone(phoneRaw);
      if (!normalized) {
        return apiError("Invalid phone number", 400);
      }
      authEmail = buildAuthEmailFromPhone(phoneRaw);
      useEmailFlow = false;
    }

    // ── Check duplicate ────────────────────────────────────────────────────
    const { data: existingEmail } = await supabase.from("users").select("id").eq("email", authEmail).maybeSingle();

    if (existingEmail) {
      return apiError("A user with this email already exists", 409);
    }

    if (phoneRaw) {
      const normalizedPhone = normalizeAuthPhone(phoneRaw);
      const { data: existingPhone } = await supabase
        .from("users")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (existingPhone) {
        return apiError("A user with this phone number already exists", 409);
      }
    }

    // ── Create auth user ────────────────────────────────────────────────────
    const authPayload: any = {
      email: authEmail,
      email_confirm: true,
    };

    if (!useEmailFlow) {
      authPayload.password = DEFAULT_PASSWORD;
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser(authPayload);

    if (authError || !authData.user) {
      logger.error("Failed to create auth user:", authError);
      return apiError("Failed to create marketer account. Check Supabase auth configuration.", 500);
    }

    // ── Create profile ──────────────────────────────────────────────────────
    const profilePayload: any = {
      id: authData.user.id,
      auth_id: authData.user.id,
      email: authEmail,
      full_name: name,
      role: "marketer",
      is_active: true,
      phone: phoneRaw ? normalizeAuthPhone(phoneRaw) : authEmail,
    };

    const { error: profileError } = await supabase.from("users").insert(profilePayload);

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      logger.error("Failed to create marketer profile:", profileError);
      return apiError("Failed to create marketer profile", 500);
    }

    // ── Email flow: send magic link ─────────────────────────────────────────
    if (useEmailFlow) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: authEmail,
        options: { redirectTo: `${request.nextUrl.origin}/dashboard` },
      });

      if (linkError || !linkData?.properties?.action_link) {
        logger.error("Failed to generate magic link:", linkError);
        await supabase.from("users").delete().eq("id", authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        return apiError("Failed to generate login link. Email service may not be fully configured.", 500);
      }

      const actionLink = linkData.properties.action_link;
      const tokenMatch = actionLink.match(/[?&]token=([^&]+)/);
      const loginUrl = tokenMatch
        ? `${request.nextUrl.origin}/auth/confirm?token=${tokenMatch[1]}&type=magiclink&email=${encodeURIComponent(authEmail)}`
        : actionLink;

      const emailResult = await sendLoginLinkEmail(authEmail, loginUrl, name);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: authData.user.id,
            email: authEmail,
            full_name: name,
            phone: profilePayload.phone || null,
            role: "marketer",
          },
          message: emailResult.success
            ? `Login link sent to ${authEmail}`
            : `Account created but login link delivery failed${emailResult.error ? `: ${emailResult.error}` : ""}. Contact the marketer directly.`,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Phone flow: return default password ─────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: authData.user.id,
          email: authEmail,
          full_name: name,
          phone: profilePayload.phone || null,
          role: "marketer",
        },
        message: `Marketer created. Default password: ${DEFAULT_PASSWORD}`,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error("POST /api/marketers error:", error);
    return handleApiError(error);
  }
}
