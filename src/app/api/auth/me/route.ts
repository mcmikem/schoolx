import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Verify the token and get the auth user
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(authHeader);
  if (authError || !authUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Fetch profile from users table using service role (bypasses RLS entirely)
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError) {
    logger.error("[API auth/me] Error fetching user:", userError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!userData) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch school data
  let schoolData = null;
  if (userData.school_id) {
    const { data: sd } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("id", userData.school_id)
      .single();
    schoolData = sd;
  }

  return NextResponse.json({ user: userData, school: schoolData });
}
