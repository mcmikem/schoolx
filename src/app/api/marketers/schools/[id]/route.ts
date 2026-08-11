import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!supabaseServiceKey) return apiError("Server configuration error", 500);

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();

    if (!profile || profile.role !== "marketer") {
      return apiError("Forbidden", 403);
    }

    const { data: school } = await supabaseAdmin.from("schools").select("id, onboarded_by").eq("id", id).maybeSingle();

    if (!school) return apiError("School not found", 404);
    if (school.onboarded_by !== profile.id) {
      return apiError("You can only edit schools you registered", 403);
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;

    if (Object.keys(updates).length === 0) {
      return apiError("No fields to update", 400);
    }

    const { error } = await supabaseAdmin.from("schools").update(updates).eq("id", id);

    if (error) throw error;

    return apiSuccess(null, "School updated successfully");
  } catch (error) {
    logger.error("[Marketer Edit School] Error:", error);
    return handleApiError(error);
  }
}
