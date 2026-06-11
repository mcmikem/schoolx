import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const token = authHeader.slice(7);
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = authUser.id;

  try {
    // Resolve school_id from the database — do NOT trust user_metadata (client-supplied)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("auth_id", userId)
      .single();
    if (profileError || !profileData) {
      return NextResponse.json({ error: "User profile not found" }, { status: 403 });
    }
    const verifiedSchoolId: string = profileData.school_id;
    if (!verifiedSchoolId) {
      return NextResponse.json({ error: "No school associated with this account" }, { status: 403 });
    }

    // Fetch student IDs for this school to scope related records
    const { data: schoolStudents } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", verifiedSchoolId);
    const studentIds = (schoolStudents || []).map((s: { id: string }) => s.id);

    const [studentsRes, attendanceRes, gradesRes, paymentsRes, messagesRes] = await Promise.all([
      supabaseAdmin.from("students").select("id, first_name, last_name, student_number, parent_name, parent_phone, class_id, status, created_at").eq("school_id", verifiedSchoolId),
      studentIds.length > 0
        ? supabaseAdmin.from("attendance").select("id, student_id, date, status").in("student_id", studentIds).limit(1000)
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? supabaseAdmin.from("grades").select("id, student_id, score, max_score, term, academic_year").in("student_id", studentIds).limit(1000)
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? supabaseAdmin.from("fee_payments").select("id, student_id, amount_paid, payment_method, payment_date").in("student_id", studentIds).limit(500)
        : Promise.resolve({ data: [] }),
      supabaseAdmin.from("messages").select("id, message, created_at, channel").eq("school_id", verifiedSchoolId).limit(500),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: profileData.id,
        full_name: profileData.full_name,
        phone: profileData.phone,
        email: profileData.email,
        role: profileData.role,
        created_at: profileData.created_at,
      },
      students: studentsRes.data || [],
      attendance: attendanceRes.data || [],
      grades: gradesRes.data || [],
      payments: paymentsRes.data || [],
      messages: messagesRes.data || [],
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="skoolmate-data-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    logger.error("[privacy/export] Error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}