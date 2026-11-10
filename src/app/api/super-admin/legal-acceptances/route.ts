import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  createServiceRoleClientOrThrow,
  handleApiError,
  requireAuthenticatedUser,
} from "@/lib/api-utils";
import { SCHOOL_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "@/lib/legal-versions";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", auth.context.authUserId)
      .maybeSingle();
    if (profileError || profile?.role !== "super_admin") return apiError("Forbidden", 403);

    const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 200));
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);
    const {
      data: schools,
      count,
      error: schoolError,
    } = await supabase
      .from("schools")
      .select("id, name, district", { count: "exact" })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (schoolError) return apiError("Could not load schools", 503);

    const schoolRows = (schools ?? []) as Array<{ id: string; name: string; district: string | null }>;
    if (!schoolRows.length) return apiSuccess({ schools: [], total: count ?? 0, limit, offset });

    const schoolIds = schoolRows.map((school) => school.id);
    const acceptanceRows: Array<{
      school_id: string;
      terms_version: string;
      privacy_notice_version: string;
      accepted_at: string;
      accepted_by_user_id: string;
    }> = [];
    const pageSize = 1000;
    for (let pageOffset = 0; ; pageOffset += pageSize) {
      const { data, error } = await supabase
        .from("school_agreement_acceptances")
        .select("school_id, terms_version, privacy_notice_version, accepted_at, accepted_by_user_id")
        .in("school_id", schoolIds)
        .order("accepted_at", { ascending: false })
        .range(pageOffset, pageOffset + pageSize - 1);
      if (error) return apiError("Could not load school acceptance records", 503);
      const rows = (data ?? []) as typeof acceptanceRows;
      acceptanceRows.push(...rows);
      if (rows.length < pageSize) break;
    }

    const latestBySchool = new Map<string, (typeof acceptanceRows)[number]>();
    for (const row of acceptanceRows) {
      if (!latestBySchool.has(row.school_id)) latestBySchool.set(row.school_id, row);
    }

    return apiSuccess({
      current: { termsVersion: SCHOOL_TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION },
      total: count ?? 0,
      limit,
      offset,
      schools: schoolRows.map((school) => {
        const accepted = latestBySchool.get(school.id) ?? null;
        return {
          ...school,
          accepted,
          upToDate:
            accepted?.terms_version === SCHOOL_TERMS_VERSION &&
            accepted?.privacy_notice_version === PRIVACY_NOTICE_VERSION,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
