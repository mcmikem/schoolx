import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  createServiceRoleClientOrThrow,
  handleApiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const PRIVACY_EVIDENCE_ROLES = ["school_admin", "admin", "headmaster"];
const AGE_ASSESSMENTS = new Set(["verified", "unknown"]);
const AGE_SOURCES = new Set(["birth_record", "school_record", "guardian_statement", "other"]);
const PROCESSING_BASES = new Set(["guardian_consent", "legal_obligation", "research_statistical", "pending"]);
const EVIDENCE_METHODS = new Set(["signed_form", "digital_record", "in_person_record", "other"]);

async function authorize(request: NextRequest, studentId: string) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const role = assertUserRoleOrDeny({
    userRole: auth.context.user.role,
    allowedRoles: PRIVACY_EVIDENCE_ROLES,
  });
  if (!role.ok) return { ok: false as const, response: role.response };

  const schoolId = auth.context.schoolId;
  if (!schoolId) return { ok: false as const, response: apiError("School context required", 403) };

  const supabase = createServiceRoleClientOrThrow();
  const { data: student, error } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) return { ok: false as const, response: apiError("Could not verify learner", 500) };
  if (!student || student.school_id !== schoolId) {
    return { ok: false as const, response: apiError("Learner not found", 404) };
  }

  return { ok: true as const, auth: auth.context, supabase, schoolId };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await authorize(request, id);
    if (!access.ok) return access.response;

    const { data, error } = await access.supabase
      .from("student_privacy_evidence")
      .select("*")
      .eq("student_id", id)
      .eq("school_id", access.schoolId)
      .maybeSingle();
    if (error) return apiError("Could not load learner privacy evidence", 500);
    return apiSuccess({ evidence: data ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await authorize(request, id);
    if (!access.ok) return access.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return apiError("A valid evidence record is required", 400);

    const ageAssessment = typeof body.ageAssessment === "string" ? body.ageAssessment : "";
    const ageSource = typeof body.ageSource === "string" ? body.ageSource : null;
    const processingBasis = typeof body.processingBasis === "string" ? body.processingBasis : "";
    const noticeVersion = typeof body.noticeVersion === "string" ? body.noticeVersion.trim() : "";
    const guardianName = typeof body.guardianName === "string" ? body.guardianName.trim() : "";
    const guardianRelationship = typeof body.guardianRelationship === "string" ? body.guardianRelationship.trim() : "";
    const guardianContact = typeof body.guardianContact === "string" ? body.guardianContact.trim() : "";
    const consentDateRaw = typeof body.consentObtainedAt === "string" ? body.consentObtainedAt : "";
    const evidenceMethod = typeof body.evidenceMethod === "string" ? body.evidenceMethod : null;
    const evidenceReference = typeof body.evidenceReference === "string" ? body.evidenceReference.trim() : "";
    const justification = typeof body.justification === "string" ? body.justification.trim() : "";

    if (!AGE_ASSESSMENTS.has(ageAssessment)) return apiError("Record whether learner age is verified or unknown", 400);
    if (!PROCESSING_BASES.has(processingBasis)) return apiError("Choose a processing basis or mark it pending", 400);
    if (!noticeVersion || noticeVersion.length > 80) return apiError("Enter a valid learner notice version", 400);
    if (ageAssessment === "verified" && (!ageSource || !AGE_SOURCES.has(ageSource))) {
      return apiError("Choose how the learner's age was verified", 400);
    }
    if (processingBasis === "guardian_consent") {
      if (!guardianName || !guardianRelationship || !consentDateRaw) {
        return apiError("Guardian name, relationship, and consent date are required", 400);
      }
      if (!evidenceMethod || !EVIDENCE_METHODS.has(evidenceMethod)) {
        return apiError("Choose how guardian consent was recorded", 400);
      }
    }
    if (["legal_obligation", "research_statistical"].includes(processingBasis) && !justification) {
      return apiError("Record why the selected statutory exception applies", 400);
    }
    if (guardianName.length > 160 || guardianRelationship.length > 80 || guardianContact.length > 120) {
      return apiError("Guardian details exceed the allowed length", 400);
    }
    if (evidenceReference.length > 500 || justification.length > 2000) {
      return apiError("Evidence details exceed the allowed length", 400);
    }

    const ageAssessedAt = ageAssessment === "verified" ? new Date().toISOString() : null;
    const consentObtainedAt = consentDateRaw ? new Date(consentDateRaw) : null;
    if (consentObtainedAt && Number.isNaN(consentObtainedAt.getTime())) {
      return apiError("Consent date is invalid", 400);
    }

    const payload = {
      student_id: id,
      school_id: access.schoolId,
      age_assessment: ageAssessment,
      age_source: ageAssessment === "verified" ? ageSource : null,
      age_assessed_at: ageAssessedAt,
      processing_basis: processingBasis,
      notice_version: noticeVersion,
      guardian_name: guardianName || null,
      guardian_relationship: guardianRelationship || null,
      guardian_contact: guardianContact || null,
      consent_obtained_at: processingBasis === "guardian_consent" ? consentObtainedAt?.toISOString() : null,
      evidence_method: processingBasis === "guardian_consent" ? evidenceMethod : null,
      evidence_reference: evidenceReference || null,
      basis_justification: justification || null,
      recorded_by: access.auth.user.id,
      recorded_at: new Date().toISOString(),
    };

    const { data, error } = await access.supabase
      .from("student_privacy_evidence")
      .upsert(payload, { onConflict: "student_id" })
      .select("*")
      .single();
    if (error) return apiError("Could not save learner privacy evidence", 500);
    return apiSuccess({ evidence: data });
  } catch (error) {
    return handleApiError(error);
  }
}
