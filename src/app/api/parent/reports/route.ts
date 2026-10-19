import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseClientOptions } from "@/lib/api-utils";
import { loadFeeClearanceMap } from "@/lib/server/fee-clearance";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createSupabaseAdmin() {
  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    supabaseClientOptions({
      auth: { persistSession: false },
    }),
  );
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: parentUser } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .maybeSingle();

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

    // A report card is released to a parent only when fees are cleared. Cards
    // stay on the register; only the parent handoff is withheld, and on the same
    // figure the bursar's screen shows — never the exam sitting.
    const { data: studentRows } = await supabaseAdmin.from("students").select("id, school_id").in("id", filteredIds);

    const clearance = new Map<string, { isCleared: boolean; balance: number }>();
    const schoolIds = [...new Set((studentRows || []).map((s: any) => s.school_id).filter(Boolean))];
    for (const sid of schoolIds) {
      const map = await loadFeeClearanceMap(supabaseAdmin, sid as string, { studentIds: filteredIds });
      map.forEach((value, key) => clearance.set(key, value));
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

    const visible = (data || []).filter((card: any) => clearance.get(card.student_id)?.isCleared !== false);
    const withheld = filteredIds
      .filter((id: string) => clearance.get(id)?.isCleared === false)
      .map((id: string) => ({ student_id: id, balance: clearance.get(id)?.balance ?? 0 }));

    return NextResponse.json({ success: true, data: visible, withheld });
  } catch (err: any) {
    logger.error("parent reports error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
