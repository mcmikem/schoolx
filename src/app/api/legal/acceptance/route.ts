import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  createServiceRoleClientOrThrow,
  handleApiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";
import { SCHOOL_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from "@/lib/legal-versions";

const SCHOOL_SIGNATORY_ROLES = ["school_admin", "headmaster"];

function authorizeSignatory(role: string) {
  return assertUserRoleOrDeny({ userRole: role, allowedRoles: SCHOOL_SIGNATORY_ROLES });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = authorizeSignatory(auth.context.user.role);
    if (!roleCheck.ok) return roleCheck.response;

    const supabase = createServiceRoleClientOrThrow();
    const { data, error } = await supabase
      .from("school_agreement_acceptances")
      .select("terms_version, privacy_notice_version, accepted_at, accepted_by_user_id")
      .eq("school_id", auth.context.schoolId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return apiError("Could not load the school's agreement record", 503);

    return apiSuccess({
      current: { termsVersion: SCHOOL_TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION },
      accepted: data ?? null,
      upToDate: data?.terms_version === SCHOOL_TERMS_VERSION && data?.privacy_notice_version === PRIVACY_NOTICE_VERSION,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = authorizeSignatory(auth.context.user.role);
    if (!roleCheck.ok) return roleCheck.response;

    const body = await request.json().catch(() => ({}));
    if (
      body?.accepted !== true ||
      body?.termsVersion !== SCHOOL_TERMS_VERSION ||
      body?.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION
    ) {
      return apiError("Review and accept the current School Agreement and Privacy Notice versions", 400);
    }

    const supabase = createServiceRoleClientOrThrow();
    const { data: latest, error: readError } = await supabase
      .from("school_agreement_acceptances")
      .select("terms_version, privacy_notice_version, accepted_at, accepted_by_user_id")
      .eq("school_id", auth.context.schoolId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readError) return apiError("Could not verify the school's agreement record", 503);
    if (latest?.terms_version === SCHOOL_TERMS_VERSION && latest?.privacy_notice_version === PRIVACY_NOTICE_VERSION) {
      return apiSuccess({ accepted: latest, upToDate: true, recorded: false });
    }

    const { data, error } = await supabase
      .from("school_agreement_acceptances")
      .insert({
        school_id: auth.context.schoolId,
        accepted_by_user_id: auth.context.user.id,
        terms_version: SCHOOL_TERMS_VERSION,
        privacy_notice_version: PRIVACY_NOTICE_VERSION,
      })
      .select("terms_version, privacy_notice_version, accepted_at, accepted_by_user_id")
      .single();

    if (error || !data) return apiError("Could not record the school's acceptance", 503);
    return apiSuccess({ accepted: data, upToDate: true, recorded: true }, "Current versions accepted", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
