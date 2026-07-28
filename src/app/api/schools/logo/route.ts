import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, requireUserWithSchool } from "@/lib/api-utils";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    const body = await request.json();
    const logoUrl = typeof body?.logoUrl === "string" ? body.logoUrl.trim() : "";

    if (!logoUrl) {
      return apiError("Logo URL is required", 400);
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("schools")
      .update({ logo_url: logoUrl })
      .eq("id", auth.context.schoolId)
      .select("id, logo_url")
      .maybeSingle();

    if (error) {
      logger.error("Failed to save school logo:", error);
      return apiError(error.message, 500);
    }

    if (!data) {
      return apiError("School record was not updated", 403);
    }

    return apiSuccess({ logo_url: data.logo_url }, "Logo saved successfully");
  } catch (error) {
    if (error instanceof Error && error.message === "Server configuration error") {
      return apiError("Server configuration error: missing Supabase service role key", 500);
    }
    return handleApiError(error);
  }
}
