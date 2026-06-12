import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: parentUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .single();

    if (!parentUser || parentUser.role !== "parent") {
      return NextResponse.json({ error: "Only parents can access this endpoint" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("student_id");
    const academicYear = searchParams.get("academic_year");
    const term = searchParams.get("term");

    const { data: children } = await supabaseAdmin
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", parentUser.id);

    if (!children || children.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const childIds = children.map((c: { student_id: string }) => c.student_id);
    const filteredIds = studentId ? childIds.filter((id: string) => id === studentId) : childIds;

    if (filteredIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    let query = supabaseAdmin
      .from("report_cards")
      .select(`
        *,
        students:student_id (
          id, first_name, last_name, student_number, gender,
          class:class_id (id, name)
        )
      `)
      .in("student_id", filteredIds)
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false });

    if (academicYear) query = query.eq("academic_year", academicYear);
    if (term) query = query.eq("term", parseInt(term));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    logger.error("parent reports error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
