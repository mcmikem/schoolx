// ============================================================================
// 🔒 LOCKED DOWN — RESET PASSWORD API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Handles password reset with token validation and rate limiting.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, supabaseClientOptions } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

// In-memory rate limiter — does not persist across serverless instances.
// For production, replace with Redis or Supabase-based rate limiting.
const resetAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    const window = 15 * 60 * 1000;
    const limit = 5;

    const entry = resetAttempts.get(ip);
    if (entry && now < entry.resetAt) {
      if (entry.count >= limit) {
        return apiError("Too many attempts. Please try again later.", 429);
      }
      entry.count++;
    } else {
      resetAttempts.set(ip, { count: 1, resetAt: now + window });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return apiError("Server configuration error", 500);
    }

    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== "string") {
      return apiError("Invalid token", 400);
    }

    if (!newPassword || typeof newPassword !== "string") {
      return apiError("New password required", 400);
    }

    if (newPassword.length < 8) {
      return apiError("Password must be at least 8 characters with one uppercase letter and one number", 400);
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return apiError("Password must contain at least one uppercase letter and one number", 400);
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseClientOptions({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    const tokenMatches = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenMatches.error || !tokenMatches.data) {
      if (tokenMatches.error) logger.error("Token lookup error:", tokenMatches.error);
      return apiError(tokenMatches.error?.message || "Invalid or expired token", 400);
    }

    const { id: tokenId, user_id: userId, expires_at: expiresAt, used_at: usedAt } = tokenMatches.data;

    if (usedAt) {
      return apiError("Token already used", 400);
    }

    if (new Date(expiresAt) < new Date()) {
      await supabase.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenId);

      return apiError("Token expired", 400);
    }

    const { data: userData } = await supabase.from("users").select("auth_id").eq("id", userId).maybeSingle();

    if (!userData?.auth_id) {
      return apiError("User not found", 404);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userData.auth_id, {
      password: newPassword,
    });

    if (updateError) {
      logger.error("Password update error:", updateError);
      return apiError(updateError.message, 500);
    }

    await supabase.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenId);

    return apiSuccess({ success: true }, "Password reset successful");
  } catch (error) {
    logger.error("[Reset Password Error]", error);
    return apiError(error instanceof Error ? error.message : "Failed to reset password", 500);
  }
}
