import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  handleApiError,
  validateRequiredFields,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import {
  createManagedUserAccount,
  createSupabaseAdminClient,
} from "@/lib/server/user-provisioning";

const VALID_ROLES = [
  "school_admin",
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
];

interface AddUserRequest {
  schoolId: string;
  fullName: string;
  phone: string;
  password: string;
  role: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;
    const schoolId = searchParams.get("schoolId") || auth.context.schoolId;
    const role = searchParams.get("role");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (auth.context.user.role !== "super_admin") {
      const scope = assertSchoolScopeOrDeny({
        userSchoolId: auth.context.schoolId,
        requestedSchoolId: schoolId,
      });
      if (!scope.ok) return scope.response;
    }

    const supabase = createServiceRoleClientOrThrow();

    let query = supabase
      .from("users")
      .select("id, auth_id, full_name, phone, role, school_id, created_at")
      .eq("school_id", schoolId)
      .limit(limit);

    if (role && VALID_ROLES.includes(role)) {
      query = query.eq("role", role);
    }

    const { data: users, error } = await query;

    if (error) {
      return apiError("Failed to fetch users", 500);
    }

    return apiSuccess({ users: users || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body: AddUserRequest = await request.json();
    const { schoolId, fullName, phone, password, role } = body;

    if (!["school_admin", "super_admin"].includes(auth.context.user.role)) {
      return apiError("Forbidden", 403);
    }

    const scope =
      auth.context.user.role === "super_admin"
        ? typeof schoolId === "string" && schoolId.length > 0
          ? { ok: true as const, schoolId }
          : {
              ok: false as const,
              response: apiError("School ID is required", 400),
            }
        : assertSchoolScopeOrDeny({
            userSchoolId: auth.context.schoolId,
            requestedSchoolId: schoolId,
          });

    if (!scope.ok) return scope.response;

    const validationError = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      ["schoolId", "fullName", "phone", "password", "role"],
    );
    if (validationError) {
      return apiError(validationError, 400);
    }

    if (!VALID_ROLES.includes(role)) {
      return apiError("Invalid role", 400);
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const account = await createManagedUserAccount({
      supabaseAdmin,
      fullName,
      phone,
      password,
      role,
      schoolId,
    });

    return apiSuccess({ userId: account.userId }, "User added successfully");
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "This phone number already exists" ||
        error.message === "Password must be at least 6 characters" ||
        error.message === "Invalid phone number" ||
        error.message === "Name must be at least 2 characters"
      ) {
        return apiError(error.message, 400);
      }
    }

    return handleApiError(error);
  }
}
