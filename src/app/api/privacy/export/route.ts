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
    const [profileRes, studentsRes, attendanceRes, gradesRes, paymentsRes, messagesRes] = await Promise.all([
      supabaseAdmin.from("users").select("*").eq("auth_id", userId).single(),
      supabaseAdmin.from("students").select("id, first_name, last_name, student_number, parent_name, parent_phone, class_id, status, created_at").eq("school_id", authUser.user_metadata?.school_id || ""),
      supabaseAdmin.from("attendance").select("id, student_id, date, status").limit(1000),
      supabaseAdmin.from("grades").select("id, student_id, score, max_score, term, academic_year").limit(1000),
      supabaseAdmin.from("fee_payments").select("id, student_id, amount_paid, payment_method, payment_date").limit(500),
      supabaseAdmin.from("messages").select("id, message, created_at, channel").limit(500),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: profileRes.data?.id,
        full_name: profileRes.data?.full_name,
        phone: profileRes.data?.phone,
        email: profileRes.data?.email,
        role: profileRes.data?.role,
        created_at: profileRes.data?.created_at,
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