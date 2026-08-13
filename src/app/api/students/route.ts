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

const STUDENT_MGMT_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "secretary"];

function generateStudentNumber() {
  const year = new Date().getFullYear();
  return `SM/${year}/${String(Date.now() % 1000000).padStart(6, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("school_id") || auth.context.schoolId;
    const classId = searchParams.get("class_id");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
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
      moduleKey: "students",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    let query = supabase
      .from("students")
      .select("*, classes(id, name, level, stream)", { count: "exact" })
      .eq("school_id", schoolId)
      .order("first_name", { ascending: true });

    if (classId && classId !== "all") {
      query = query.eq("class_id", classId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      const term = `%${search}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},student_number.ilike.${term},parent_name.ilike.${term}`,
      );
    }

    const { data: students, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error("Failed to fetch students:", error);
      return apiError(error.message, 500);
    }

    return apiSuccess({ students: students || [], total: count || 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { schoolId, ...studentData } = body;

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: STUDENT_MGMT_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const missing = validateRequiredFields(studentData, [
      "first_name",
      "last_name",
      "gender",
      "parent_name",
      "parent_phone",
    ]);
    if (missing) {
      return apiError(missing, 400);
    }

    if (!["M", "F"].includes(studentData.gender)) {
      return apiError("Gender must be 'M' or 'F'", 400);
    }

    const openingBalance =
      typeof studentData.opening_balance === "number" && !isNaN(studentData.opening_balance)
        ? studentData.opening_balance
        : typeof studentData.opening_balance === "string"
          ? parseFloat(studentData.opening_balance.replace(/[^\d.\-]/g, ""))
          : 0;

    const supabase = createServiceRoleClientOrThrow();

    const moduleCheck = await requireModuleEntitlement({
      supabase,
      schoolId,
      moduleKey: "students",
    });
    if (!moduleCheck.ok) return moduleCheck.response;

    const payload = {
      school_id: schoolId,
      first_name: String(studentData.first_name).trim(),
      last_name: String(studentData.last_name).trim(),
      gender: studentData.gender,
      date_of_birth: studentData.date_of_birth || null,
      parent_name: String(studentData.parent_name).trim(),
      parent_phone: String(studentData.parent_phone).trim(),
      parent_phone2: studentData.parent_phone2 || null,
      parent_email: studentData.parent_email || null,
      address: studentData.address || null,
      class_id: studentData.class_id || null,
      student_number: String(studentData.student_number || "").trim() || generateStudentNumber(),
      ple_index_number: studentData.ple_index_number || null,
      opening_balance: isNaN(openingBalance) ? 0 : openingBalance,
      boarding_status: studentData.boarding_status || "day",
      house_id: studentData.house_id || null,
      previous_school: studentData.previous_school || null,
      district_origin: studentData.district_origin || null,
      sub_county: studentData.sub_county || null,
      parish: studentData.parish || null,
      village: studentData.village || null,
      photo_url: studentData.photo_url || null,
      blood_type: studentData.blood_type || null,
      religion: studentData.religion || null,
      nationality: studentData.nationality || "Ugandan",
      prefect_role: studentData.prefect_role || null,
      student_council_role: studentData.student_council_role || null,
      games_house: studentData.games_house || null,
      is_class_monitor: studentData.is_class_monitor === true,
      nin: studentData.nin || null,
      status: studentData.status || "active",
    };

    const { data, error } = await supabase.from("students").insert(payload).select("id, student_number").single();

    if (error) {
      logger.error("[API Students] Insert failed:", error);
      return apiError(error.message, 500);
    }

    logger.info(`Created student ${data.id} (${payload.first_name} ${payload.last_name}) in school ${schoolId}`);

    return apiSuccess({ id: data.id, student_number: data.student_number }, "Student created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
