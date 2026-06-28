import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  validateRequiredFields,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { requireModuleEntitlement } from "@/lib/subscription-guard";

const FEE_MGMT_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "secretary",
  "bursar",
];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("school_id") || auth.context.schoolId;
    const classId = searchParams.get("class_id");
    const term = searchParams.get("term");
    const academicYear = searchParams.get("academic_year");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: schoolId,
      });
      if (!scope.ok) return scope.response;
    }

    const supabase = createServiceRoleClientOrThrow();

    const moduleCheck = await requireModuleEntitlement({
      supabase,
      schoolId: schoolId as string,
      moduleKey: "finance",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    let query = supabase
      .from("fee_structure")
      .select("*, classes(id, name, level, stream)", { count: "exact" })
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (classId && classId !== "all") {
      query = query.eq("class_id", classId);
    }

    if (term) {
      query = query.eq("term", parseInt(term));
    }

    if (academicYear) {
      query = query.eq("academic_year", academicYear);
    }

    const { data: fees, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return apiError("Failed to fetch fee structures", 500);
    }

    return apiSuccess({ fees: fees || [], total: count || 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { schoolId, ...feeData } = body;

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: FEE_MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const missing = validateRequiredFields(feeData, [
      "name",
      "amount",
      "term",
      "academic_year",
    ]);
    if (missing) {
      return apiError(missing, 400);
    }

    const parsedAmount = parseFloat(feeData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return apiError("Amount must be a positive number", 400);
    }

    const termNum = parseInt(feeData.term);
    if (![1, 2, 3].includes(termNum)) {
      return apiError("Term must be 1, 2, or 3", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const moduleCheck = await requireModuleEntitlement({
      supabase,
      schoolId,
      moduleKey: "finance",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    const payload = {
      school_id: schoolId,
      class_id: feeData.class_id || null,
      name: String(feeData.name).trim(),
      amount: parsedAmount,
      term: termNum,
      academic_year: feeData.academic_year,
      due_date: feeData.due_date || null,
    };

    const { data, error } = await supabase
      .from("fee_structure")
      .insert(payload)
      .select("id, name, amount")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("A fee structure with the same name, class, term, and academic year already exists", 409);
      }
      logger.error("[API Fees] Insert failed:", error);
      return apiError("Failed to create fee structure", 500);
    }

    logger.info(
      `Created fee structure ${data.id} (${payload.name}) in school ${schoolId}`,
    );

    return apiSuccess({ id: data.id }, "Fee structure created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
