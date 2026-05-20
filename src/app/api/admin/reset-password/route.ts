import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return apiError("Server configuration error", 500);
    }

    const body = await request.json();
    const { userId, password } = body;

    if (!userId || !password) {
      return apiError("User ID and password are required", 400);
    }

    if (password.length < 6) {
      return apiError("Password must be at least 6 characters", 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get user data to find auth_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("auth_id")
      .eq("id", userId)
      .single();

    if (userError || !userData?.auth_id) {
      return apiError("User not found", 404);
    }

    // Update password via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.auth_id,
      { password: password },
    );

    if (updateError) {
      logger.error("Failed to update password:", updateError);
      return apiError("Failed to update password", 500);
    }

    return apiSuccess({ success: true }, "Password reset successful");
  } catch (error) {
    logger.error("[Admin Reset Password Error]", error);
    return apiError("Failed to reset password", 500);
  }
}
