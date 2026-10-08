import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseClientOptions } from "@/lib/api-utils";

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

// Roles that may define or read a school's grading scheme. Grading rules are
// configuration, not classroom data, so teachers are read-only consumers.
const SCHEME_WRITE_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "dean_of_studies"];

async function requireCaller(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  req: NextRequest,
): Promise<{ profile: { role: string; school_id: string | null }; response?: never } | { response: NextResponse }> {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authHeader) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(authHeader);
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role, school_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { profile: profile as { role: string; school_id: string | null } };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    const subjectId = searchParams.get("subject_id");

    if (!schoolId) return NextResponse.json({ error: "school_id required" }, { status: 400 });

    const supabaseAdmin = createSupabaseAdmin();
    const caller = await requireCaller(supabaseAdmin, req);
    if ("response" in caller) return caller.response;

    // Service role reads bypass RLS, so tenancy has to be checked here or any
    // signed-in user can read another school's grading scheme.
    if (caller.profile.role !== "super_admin" && caller.profile.school_id !== schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("grading_schemes")
      .select("*")
      .eq("school_id", schoolId)
      .order("min_score", { ascending: false });

    if (subjectId) query = query.or(`subject_id.eq.${subjectId},subject_id.is.null`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    logger.error("grading-schemes GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const caller = await requireCaller(supabaseAdmin, req);
    if ("response" in caller) return caller.response;

    const body = await req.json();
    const { school_id, name, subject_id, min_score, max_score, grade, points, division, is_default } = body;

    if (!school_id || min_score === undefined || max_score === undefined || !grade) {
      return NextResponse.json({ error: "school_id, min_score, max_score, grade required" }, { status: 400 });
    }

    // Previously any authenticated user could insert a scheme for any school.
    if (caller.profile.role !== "super_admin") {
      if (!SCHEME_WRITE_ROLES.includes(caller.profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (caller.profile.school_id !== school_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("grading_schemes")
      .insert({
        school_id,
        name: name || "UNEB",
        subject_id: subject_id || null,
        min_score,
        max_score,
        grade,
        points: points || 0,
        division: division || null,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    logger.error("grading-schemes POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
