import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase.auth.getSession();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.user.id)
    .maybeSingle();

  if (userProfile?.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const validation = validateEnv();

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    const missing = validation.errors || [];
    return NextResponse.json({
      success: true,
      valid: validation.valid,
      missing_count: missing.length,
      all_required_set: missing.length === 0,
    });
  }

  if (validation.valid) {
    return NextResponse.json({ valid: true });
  }

  const missing = validation.errors || [];
  return NextResponse.json({
    valid: false,
    missing_count: missing.length,
    all_required_set: false,
  });
}
