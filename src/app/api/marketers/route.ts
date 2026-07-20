import { NextRequest } from "next/server";
import {
  createServiceRoleClientOrThrow,
  apiSuccess,
  apiError,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const DEFAULT_PASSWORD = "Omutofoundation";

async function requireSuperAdmin(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

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

export async function GET(request: NextRequest) {
  try {
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    if (!body.email) {
      return apiError("Missing required field: email", 400);
    }

    const email = (body.email as string).trim().toLowerCase();
    if (!email.includes("@")) {
      return apiError("Invalid email address", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { data: existingUser } = await supabase.from("users").select("id").eq("email", email).maybeSingle();

    if (existingUser) {
      return apiError("A user with this email already exists", 409);
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      logger.error("Failed to create auth user:", authError);
      return apiError("Failed to create marketer account. Check Supabase auth configuration.", 500);
    }

    const fullName = body.full_name || email.split("@")[0];

    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      auth_id: authData.user.id,
      email,
      full_name: fullName,
      role: "marketer",
      is_active: true,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      logger.error("Failed to create marketer profile:", profileError);
      return apiError("Failed to create marketer profile", 500);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: authData.user.id,
          email,
          full_name: fullName,
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
