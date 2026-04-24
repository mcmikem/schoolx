import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { apiSuccess, apiError } from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== "string") {
      return apiError("Invalid token", 400);
    }

    if (!newPassword || typeof newPassword !== "string") {
      return apiError("New password required", 400);
    }

    if (newPassword.length < 8) {
      return apiError(
        "Password must be at least 8 characters with one uppercase letter and one number",
        400,
      );
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return apiError(
        "Password must contain at least one uppercase letter and one number",
        400,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tokenHash = randomBytes(32).toString("hex");
    const tokenMatches = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", token)
      .single();

    if (tokenMatches.error || !tokenMatches.data) {
      return apiError("Invalid or expired token", 400);
    }

    const {
      id: tokenId,
      user_id: userId,
      expires_at: expiresAt,
      used_at: usedAt,
    } = tokenMatches.data;

    if (usedAt) {
      return apiError("Token already used", 400);
    }

    if (new Date(expiresAt) < new Date()) {
      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenId);

      return apiError("Token expired", 400);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("auth_id")
      .eq("id", userId)
      .single();

    if (!userData?.auth_id) {
      return apiError("User not found", 404);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.auth_id,
      { password: newPassword },
    );

    if (updateError) {
      return apiError("Failed to update password", 500);
    }

    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenId);

    return apiSuccess({ success: true }, "Password reset successful");
  } catch (error) {
    console.error("[Reset Password Error]", error);
    return apiError("Failed to reset password", 500);
  }
}
