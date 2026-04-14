import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  withSecurity,
} from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface StudentRow {
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  parent_name: string;
  parent_phone: string;
  parent_phone2?: string;
  class_name: string;
  student_number?: string;
  ple_index_number?: string;
}

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { students, schoolId } = await request.json();

    if (!students || !students.length || !schoolId) {
      return apiError("Students data and schoolId are required", 400);
    }

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    });
    if (!scope.ok) return scope.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: ["super_admin", "school_admin"],
    });
    if (!roleCheck.ok) return roleCheck.response;

    const supabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Get all classes for this school to map class names to IDs
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", scope.schoolId);

    const classMap = new Map(
      classes?.map((c) => [c.name.toLowerCase(), c.id]) || [],
    );

    // Get current count for generating student numbers
    const { count } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", scope.schoolId);

    let studentCount = count || 0;

    for (const student of students as StudentRow[]) {
      try {
        // Find class ID
        const classId = classMap.get(student.class_name?.toLowerCase());
        if (!classId) {
          results.errors.push(
            `${student.first_name} ${student.last_name}: Class "${student.class_name}" not found`,
          );
          results.failed++;
          continue;
        }

        // Generate student number if not provided
        studentCount++;
        const studentNumber =
          student.student_number ||
          `STU${String(studentCount).padStart(5, "0")}`;

        // Validate gender
        const gender =
          student.gender?.toUpperCase() === "M" ||
          student.gender?.toUpperCase() === "MALE"
            ? "M"
            : student.gender?.toUpperCase() === "F" ||
                student.gender?.toUpperCase() === "FEMALE"
              ? "F"
              : null;

        if (!gender) {
          results.errors.push(
            `${student.first_name} ${student.last_name}: Invalid gender "${student.gender}"`,
          );
          results.failed++;
          continue;
        }

        const { error } = await supabase.from("students").insert({
          school_id: scope.schoolId,
          student_number: studentNumber,
          first_name: student.first_name,
          last_name: student.last_name,
          gender: gender,
          date_of_birth: student.date_of_birth || null,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone,
          parent_phone2: student.parent_phone2 || null,
          class_id: classId,
          ple_index_number: student.ple_index_number || null,
          status: "active",
        });

        if (error) {
          results.errors.push(
            `${student.first_name} ${student.last_name}: ${error.message}`,
          );
          results.failed++;
        } else {
          results.success++;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        results.errors.push(
          `${student.first_name} ${student.last_name}: ${errorMessage}`,
        );
        results.failed++;
      }
    }

    return apiSuccess(results, `Imported ${results.success} students`);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withSecurity(handlePost, {
  rateLimit: { limit: 10, windowMs: 60000 },
});
