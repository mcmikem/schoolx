import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, supabaseClientOptions } from "@/lib/api-utils";
import { normalizeAuthPhone } from "@/lib/validation";
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return apiError("CSV file is required", 400);

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) return apiError("CSV must have a header row and at least one data row", 400);

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const schoolNameIdx = headers.findIndex((h) => h.includes("school") || h.includes("name"));
    const contactNameIdx = headers.findIndex(
      (h) => h.includes("contact") || h.includes("person") || h.includes("name"),
    );
    const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
    const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
    const districtIdx = headers.findIndex((h) => h.includes("district") || h.includes("location"));

    if (schoolNameIdx < 0) return apiError('CSV must have a "school_name" column', 400);

    const leads: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const schoolName = cols[schoolNameIdx];
      if (!schoolName) {
        errors.push(`Row ${i + 1}: missing school name`);
        continue;
      }
      leads.push({
        school_name: schoolName,
        contact_name: contactNameIdx >= 0 ? cols[contactNameIdx] || null : null,
        contact_phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
        contact_email: emailIdx >= 0 ? cols[emailIdx] || null : null,
        district: districtIdx >= 0 ? cols[districtIdx] || null : null,
        status: "new",
        marketer_id: profile.id,
      });
    }

    if (leads.length === 0) {
      return apiError("No valid leads found in CSV", 400);
    }

    const { error: insertError } = await supabaseAdmin.from("leads").insert(leads);

    if (insertError) throw insertError;

    return apiSuccess(
      { imported: leads.length, errors: errors.length },
      `Imported ${leads.length} lead${leads.length !== 1 ? "s" : ""}${errors.length ? ` (${errors.length} skipped)` : ""}`,
    );
  } catch (error) {
    logger.error("[Lead Import] Error:", error);
    return handleApiError(error);
  }
}
