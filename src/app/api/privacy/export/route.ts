import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseClientOptions } from "@/lib/api-utils";

/** Return only the authenticated person's own account data. */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey,
    supabaseClientOptions({ auth: { persistSession: false } }),
  );

  try {
    const token = authHeader.slice(7);
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, phone, email, role, created_at, school_id")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 403 });
    }

    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      scope: "Authenticated account holder's own profile. No other learners or school-wide records are included.",
      account: {
        full_name: profile.full_name,
        phone: profile.phone,
        email: profile.email,
        role: profile.role,
        created_at: profile.created_at,
      },
    };

    // Student accounts may export their own linked learner record and records
    // keyed to that learner. Parent accounts do not export linked children's
    // records through this endpoint; those requests need school/guardian review.
    if (profile.role === "student" && profile.school_id) {
      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .select("id, first_name, last_name, student_number, gender, date_of_birth, class_id, status, admission_date")
        .eq("user_id", profile.id)
        .eq("school_id", profile.school_id)
        .maybeSingle();
      if (studentError) throw studentError;

      if (student) {
        const [attendance, grades, payments] = await Promise.all([
          supabaseAdmin
            .from("attendance")
            .select("date, status")
            .eq("student_id", student.id)
            .order("date", { ascending: true })
            .limit(5000),
          supabaseAdmin
            .from("grades")
            .select("score, max_score, term, academic_year")
            .eq("student_id", student.id)
            .limit(5000),
          supabaseAdmin
            .from("fee_payments")
            .select("amount_paid, payment_method, payment_date")
            .eq("student_id", student.id)
            .limit(5000),
        ]);
        if (attendance.error) throw attendance.error;
        if (grades.error) throw grades.error;
        if (payments.error) throw payments.error;
        Object.assign(exportData, {
          learner_record: student,
          attendance: attendance.data ?? [],
          grades: grades.data ?? [],
          fee_payments: payments.data ?? [],
        });
      }
    }

    const filenameDate = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="skoolmate-account-data-${filenameDate}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error("[privacy/export] Failed to prepare personal data export", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
