import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { requireUserWithSchool } from "@/lib/api-utils";

// ─── Guard ────────────────────────────────────────────────────────────────────

async function guardSuperAdmin(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };
  if (auth.context.user.role !== "super_admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

// ─── Allowed fields ───────────────────────────────────────────────────────────

const SCHOOL_EDITABLE_FIELDS = new Set([
  "name", "district", "phone", "email", "primary_color", "school_type", "ownership",
  "subscription_plan", "subscription_status", "feature_stage", "trial_ends_at",
]);

const USER_EDITABLE_FIELDS = new Set(["is_active", "role"]);

const VALID_ROLES = [
  "super_admin", "school_admin", "admin", "headmaster", "dean_of_studies",
  "bursar", "teacher", "secretary", "dorm_master", "student", "parent",
];

// ─── POST handler (all mutations) ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = await guardSuperAdmin(request);
  if (!guard.ok) return guard.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;
  if (!action || typeof action !== "string") {
    return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // ── update_school ──────────────────────────────────────────────────────────
  if (action === "update_school") {
    const { id, fields } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing school id" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    // Whitelist fields
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (SCHOOL_EDITABLE_FIELDS.has(k)) safe[k] = v;
    }
    if (Object.keys(safe).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await admin.from("schools").update(safe).eq("id", id);
    if (error) {
      console.error("[actions] update_school error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // ── create_school ──────────────────────────────────────────────────────────
  if (action === "create_school") {
    const { name, school_code, district, school_type, ownership, phone, email,
            primary_color, subscription_plan, feature_stage, trial_days } = body;

    if (!name?.trim() || !school_code?.trim() || !district?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name, school code, and district are required" },
        { status: 400 },
      );
    }

    // Check for duplicate school code
    const { data: existing } = await admin
      .from("schools")
      .select("id")
      .eq("school_code", school_code.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: `School code "${school_code.trim().toUpperCase()}" is already in use` },
        { status: 409 },
      );
    }

    const days = Number(trial_days) || 30;
    const trialEnd = new Date(Date.now() + days * 86400000).toISOString();

    const { data, error } = await admin
      .from("schools")
      .insert({
        name: name.trim(),
        school_code: school_code.trim().toUpperCase(),
        district: district.trim(),
        school_type: school_type || "primary",
        ownership: ownership || "private",
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        primary_color: primary_color || "#001F3F",
        subscription_plan: subscription_plan || "starter",
        subscription_status: "trial",
        feature_stage: feature_stage || "full",
        trial_ends_at: trialEnd,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[actions] create_school error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: data?.id });
  }

  // ── update_user ────────────────────────────────────────────────────────────
  if (action === "update_user") {
    const { id, fields } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing user id" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (USER_EDITABLE_FIELDS.has(k)) safe[k] = v;
    }
    if ("role" in safe && !VALID_ROLES.includes(safe.role as string)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }
    if (Object.keys(safe).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await admin.from("users").update(safe).eq("id", id);
    if (error) {
      console.error("[actions] update_user error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // ── delete_user ────────────────────────────────────────────────────────────
  if (action === "delete_user") {
    const { id } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing user id" }, { status: 400 });
    }

    // Get the auth_id first
    const { data: userRow, error: fetchErr } = await admin
      .from("users")
      .select("id, auth_id, role")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !userRow) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Prevent deleting super_admin accounts
    if (userRow.role === "super_admin") {
      return NextResponse.json(
        { success: false, error: "Cannot delete a super admin account" },
        { status: 403 },
      );
    }

    // Delete from auth (cascades to users table via ON DELETE CASCADE)
    if (userRow.auth_id) {
      const { error: authErr } = await admin.auth.admin.deleteUser(userRow.auth_id);
      if (authErr) {
        console.error("[actions] delete auth user error:", authErr);
        return NextResponse.json({ success: false, error: authErr.message }, { status: 500 });
      }
    } else {
      // No auth entry, delete profile row directly
      const { error: deleteErr } = await admin.from("users").delete().eq("id", id);
      if (deleteErr) {
        return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  }

  // ── reset_user_password ────────────────────────────────────────────────────
  if (action === "reset_user_password") {
    const { id, new_password } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing user id" }, { status: 400 });
    }
    if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const { data: userRow } = await admin
      .from("users")
      .select("auth_id, role")
      .eq("id", id)
      .maybeSingle();

    if (!userRow?.auth_id) {
      return NextResponse.json({ success: false, error: "User auth record not found" }, { status: 404 });
    }

    const { error } = await admin.auth.admin.updateUserById(userRow.auth_id, {
      password: new_password,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}
