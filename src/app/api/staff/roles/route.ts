// ============================================================================
// 🔒 STAFF ROLES API — give a person more than one hat
// ============================================================================
// Rural schools do not have one job per person. A headmaster also teaches.
// A director of studies also teaches. A bursar is also a parent. The
// database has held `user_roles` (every hat a person wears) since the
// multi-role migration, and the app has read it since -- but nothing ever
// WROTE a second hat, so everybody was still on one role.
//
// This route is the missing write path:
//   - `users.role` stays the PRIMARY role (labels, receipts, the dashboard
//     they land on). Changing it would change who they are on paper.
//   - `user_roles` holds every hat, primary first.
//   - `users.preferred_dashboard` is which screen they want to land on when
//     they wear more than one hat.
//
// It runs on the service role because it writes two tables that must agree,
// and because a half-applied role change is worse than none: the person
// would keep the old permissions on one screen and the new ones on another.
//
// Security: the caller must be an admin of the school the person belongs to.
// A teacher cannot hand themselves a headmaster's permissions.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { rateLimit, supabaseClientOptions } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** The hats a person may wear. Mirrors the app_role enum. */
const ALLOWED_ROLES = [
  "teacher",
  "headmaster",
  "dean_of_studies",
  "bursar",
  "secretary",
  "dorm_master",
  "school_admin",
  "admin",
  "board",
  "parent",
  "marketer",
  "super_admin",
] as const;

/** Hats that are only ever worn by the person who owns the school. */
const RESTRICTED_ROLES = ["super_admin", "admin"] as const;

/** The screens a person can choose to land on. Mirrors the
 *  users_preferred_dashboard_check constraint. */
const DASHBOARDS = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "super_admin",
  "marketer",
] as const;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: rlOk } = rateLimit(request, 30, 60_000);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey,
    supabaseClientOptions({ auth: { persistSession: false } }),
  );

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(authHeader);
  if (authError || !authUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data: caller } = await supabaseAdmin
    .from("users")
    .select("id, school_id, role")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (!caller) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  // Only an admin of the school may hand out hats in it. A headmaster may
  // hand out hats in their own school; a teacher may not.
  const callerRoles = await rolesOf(supabaseAdmin, caller.id, caller.role);
  const callerIsAdmin = callerRoles.some((role) =>
    ["school_admin", "admin", "super_admin", "headmaster"].includes(role),
  );
  if (!callerIsAdmin) {
    return NextResponse.json({ error: "You cannot change staff roles" }, { status: 403 });
  }

  let body: { user_id?: unknown; roles?: unknown; preferred_dashboard?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const targetId = typeof body.user_id === "string" ? body.user_id : "";
  const requested = Array.isArray(body.roles) ? body.roles.filter((r): r is string => typeof r === "string") : [];
  if (!targetId || requested.length === 0) {
    return NextResponse.json({ error: "Choose at least one role" }, { status: 400 });
  }

  const roles = [...new Set(requested)];
  for (const role of roles) {
    if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 });
    }
    // The platform roles are not a hat a school can hand out.
    if ((RESTRICTED_ROLES as readonly string[]).includes(role) && role !== caller.role) {
      return NextResponse.json({ error: `The ${role} role cannot be assigned here` }, { status: 400 });
    }
  }

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, school_id, role")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }
  if (target.school_id !== caller.school_id && caller.role !== "super_admin") {
    return NextResponse.json({ error: "That person is not in your school" }, { status: 403 });
  }

  const preferred =
    typeof body.preferred_dashboard === "string" && body.preferred_dashboard.length > 0
      ? body.preferred_dashboard
      : null;
  if (preferred && !(DASHBOARDS as readonly string[]).includes(preferred)) {
    return NextResponse.json({ error: "Unknown dashboard" }, { status: 400 });
  }
  if (preferred && !roles.includes(preferred)) {
    return NextResponse.json({ error: "They do not hold that role" }, { status: 400 });
  }

  try {
    // The first hat is the primary one: it labels the person, names the
    // receipts, and decides the dashboard they land on.
    const primary = roles[0];

    // 1. The hats themselves. Replace rather than merge, so a hat that was
    //    taken away actually goes away.
    const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabaseAdmin.from("user_roles").insert(
      roles.map((role, index) => ({
        user_id: targetId,
        role,
        is_primary: index === 0,
      })),
    );
    if (insertError) throw insertError;

    // 2. The primary role and the landing screen, on the profile.
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ role: primary, preferred_dashboard: preferred })
      .eq("id", targetId);
    if (updateError) throw updateError;

    // 3. The auth user carries the role in its metadata too, and some
    //    screens read it before the profile lands.
    const { data: targetAuth } = await supabaseAdmin.from("users").select("auth_id").eq("id", targetId).maybeSingle();
    if (targetAuth?.auth_id) {
      const { data: authRow } = await supabaseAdmin.auth.admin.getUserById(targetAuth.auth_id);
      if (authRow?.user) {
        await supabaseAdmin.auth.admin.updateUserById(targetAuth.auth_id, {
          user_metadata: { ...(authRow.user.user_metadata ?? {}), role: primary },
        });
      }
    }

    return NextResponse.json({ success: true, roles, primary, preferred_dashboard: preferred });
  } catch (err) {
    logger.error("[API staff/roles] Error:", err);
    return NextResponse.json({ error: "Could not save the roles" }, { status: 500 });
  }
}

/** Every hat a person wears, primary first, with the profile's own role as
 *  a fallback for a database that has not run the migration yet. */
async function rolesOf(client: SupabaseClient, userId: string, fallbackRole: string): Promise<string[]> {
  const { data } = await client.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => String((r as { role: unknown }).role));
  if (roles.length > 0) return roles;
  return fallbackRole ? [fallbackRole] : [];
}
