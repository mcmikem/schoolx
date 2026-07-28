import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { requireUserWithSchool } from "@/lib/api-utils";
import { normalizeAuthPhone } from "@/lib/validation";
import { PRIMARY_TEMPLATE, SECONDARY_TEMPLATE } from "@/lib/curriculum-templates";
import { buildDefaultClasses, type SchoolSetupType } from "@/lib/school-setup";
import { buildUgandaAcademicTerms, buildUgandaCalendarEvents } from "@/lib/uganda-school-calendar";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { logger } from "@/lib/logger";

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
  "name",
  "district",
  "phone",
  "email",
  "primary_color",
  "school_type",
  "ownership",
  "subscription_plan",
  "subscription_status",
  "feature_stage",
  "trial_ends_at",
  "is_tester",
  // Report & ID card customization
  "address",
  "motto",
  "principal_name",
  "report_header",
  "report_footer",
  "id_card_style",
]);

const USER_EDITABLE_FIELDS = new Set(["is_active", "role"]);

const VALID_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "student",
  "parent",
];

// ─── POST handler (all mutations) ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
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
        logger.error("[actions] update_school error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // ── create_school (full provisioning) ────────────────────────────────────
    if (action === "create_school") {
      const {
        name,
        school_code,
        district,
        subcounty,
        parish,
        village,
        school_type,
        ownership,
        phone,
        email,
        primary_color,
        subscription_plan,
        feature_stage,
        trial_days,
        admin_name,
        admin_phone,
        admin_password,
        digitization_fee,
      } = body;

      if (!name?.trim() || !school_code?.trim() || !district?.trim()) {
        return NextResponse.json(
          { success: false, error: "Name, school code, and district are required" },
          { status: 400 },
        );
      }
      if (!admin_name?.trim() || !admin_phone?.trim() || !admin_password) {
        return NextResponse.json(
          { success: false, error: "Admin name, phone, and password are required" },
          { status: 400 },
        );
      }
      if (admin_password.length < 8) {
        return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
      }

      const normalizedPhone = normalizeAuthPhone(admin_phone);
      if (normalizedPhone.length < 10 || normalizedPhone.length > 12) {
        return NextResponse.json({ success: false, error: "Invalid phone number" }, { status: 400 });
      }

      // Check for duplicate school code
      const { data: existingSchool } = await admin
        .from("schools")
        .select("id")
        .eq("school_code", school_code.trim().toUpperCase())
        .maybeSingle();
      if (existingSchool) {
        return NextResponse.json(
          { success: false, error: `School code "${school_code.trim().toUpperCase()}" is already in use` },
          { status: 409 },
        );
      }

      // Check for existing user
      const { data: existingUser } = await admin.from("users").select("id").eq("phone", normalizedPhone).maybeSingle();
      if (existingUser) {
        return NextResponse.json({ success: false, error: "Phone number already registered" }, { status: 409 });
      }

      const rollbacks: Array<() => Promise<void>> = [];
      try {
        // 1. Create auth user
        const hasValidEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
        const emailForAuth = hasValidEmail ? email.trim().toLowerCase() : `${normalizedPhone}@omuto.org`;
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: emailForAuth,
          password: admin_password,
          email_confirm: true,
          user_metadata: { full_name: admin_name, phone: normalizedPhone, role: "school_admin" },
        });
        if (authError) {
          const msg = authError.message;
          if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already taken")) {
            return NextResponse.json({ success: false, error: "This account already exists" }, { status: 409 });
          }
          throw authError;
        }
        rollbacks.push(async () => {
          await admin.auth.admin.deleteUser(authData.user.id);
        });

        // 2. Create school
        const days = Number(trial_days) || 30;
        const trialEnd = new Date(Date.now() + days * 86400000).toISOString();
        const subscriptionPlan = normalizePlanType(subscription_plan || "starter");
        const { data: schoolData, error: schoolError } = await admin
          .from("schools")
          .insert({
            name: name.trim(),
            school_code: school_code.trim().toUpperCase(),
            district: district.trim(),
            subcounty: subcounty?.trim() || null,
            parish: parish?.trim() || null,
            village: village?.trim() || null,
            school_type: school_type || "primary",
            ownership: ownership || "private",
            phone: phone?.trim() || null,
            email: hasValidEmail ? email.trim().toLowerCase() : null,
            primary_color: primary_color || "#001F3F",
            subscription_plan: subscriptionPlan,
            subscription_status: "trial",
            feature_stage: feature_stage || "full",
            trial_ends_at: trialEnd,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (schoolError) throw schoolError;
        rollbacks.push(async () => {
          await admin.from("schools").delete().eq("id", schoolData.id);
        });

        // 3. Create user record
        const { error: userError } = await admin.from("users").insert({
          auth_id: authData.user.id,
          school_id: schoolData.id,
          full_name: admin_name.trim(),
          phone: normalizedPhone,
          email: hasValidEmail ? email.trim().toLowerCase() : null,
          role: "school_admin",
          is_active: true,
        });
        if (userError) throw userError;

        // 4. Seed curriculum
        const currentYear = new Date().getFullYear().toString();
        const defaultSubjects =
          school_type === "secondary"
            ? SECONDARY_TEMPLATE.subjects
            : school_type === "combined"
              ? [...PRIMARY_TEMPLATE.subjects, ...SECONDARY_TEMPLATE.subjects].filter(
                  (s, i, a) => a.findIndex((x) => x.code === s.code && x.level === s.level) === i,
                )
              : PRIMARY_TEMPLATE.subjects;
        if (defaultSubjects.length > 0) {
          await admin.from("subjects").insert(
            defaultSubjects.map((s: any) => ({
              school_id: schoolData.id,
              name: s.name,
              code: s.code,
              level: s.level,
              is_compulsory: s.is_compulsory,
            })),
          );
        }

        const defaultClasses = buildDefaultClasses(
          schoolData.id,
          (school_type || "primary") as SchoolSetupType,
          currentYear,
        );
        if (defaultClasses.length > 0) {
          await admin.from("classes").insert(defaultClasses);
        }

        const { data: academicYear } = await admin
          .from("academic_years")
          .insert({ school_id: schoolData.id, year: currentYear, is_current: true })
          .select("id")
          .single();

        if (academicYear) {
          const terms = buildUgandaAcademicTerms(schoolData.id, currentYear);
          await admin.from("academic_terms").upsert(
            terms.map((t: any) => ({ ...t, academic_year_id: academicYear.id })),
            { onConflict: "school_id,academic_year,term_number" },
          );
        }
        await admin.from("events").insert(buildUgandaCalendarEvents(schoolData.id, currentYear));

        // 5. Optional digitization fee
        const digiFee = Math.max(0, Number(digitization_fee) || 0);
        if (digiFee >= 10000 && digiFee <= 50000) {
          try {
            await admin.from("marketer_earnings").insert({
              school_id: schoolData.id,
              earning_type: "digitization_fee",
              amount: digiFee,
              currency: "UGX",
              status: "pending",
              notes: "Digitization fee (super admin registration)",
            });
          } catch (e) {
            logger.warn("[actions] digitization fee insert failed, non-fatal:", e);
          }
        }

        return NextResponse.json({
          success: true,
          id: schoolData.id,
          adminPhone: normalizedPhone,
          adminEmail: emailForAuth,
        });
      } catch (error) {
        for (let i = rollbacks.length - 1; i >= 0; i--) {
          try {
            await rollbacks[i]();
          } catch (e) {
            logger.error("[actions] rollback error:", e);
          }
        }
        logger.error("[actions] create_school error:", error);
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : "Internal server error" },
          { status: 500 },
        );
      }
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
        logger.error("[actions] update_user error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
        return NextResponse.json({ success: false, error: "Cannot delete a super admin account" }, { status: 403 });
      }

      // Delete from auth (cascades to users table via ON DELETE CASCADE)
      if (userRow.auth_id) {
        const { error: authErr } = await admin.auth.admin.deleteUser(userRow.auth_id);
        if (authErr) {
          logger.error("[actions] delete auth user error:", authErr);
          return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
        }
      } else {
        // No auth entry, delete profile row directly
        const { error: deleteErr } = await admin.from("users").delete().eq("id", id);
        if (deleteErr) {
          logger.error("[actions] delete user profile error:", deleteErr);
          return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
        return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
      }

      const { data: userRow } = await admin.from("users").select("auth_id, role").eq("id", id).maybeSingle();

      if (!userRow?.auth_id) {
        return NextResponse.json({ success: false, error: "User auth record not found" }, { status: 404 });
      }

      const { error } = await admin.auth.admin.updateUserById(userRow.auth_id, {
        password: new_password,
      });
      if (error) {
        logger.error("[actions] reset password error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // ── delete_school ──────────────────────────────────────────────────────────
    if (action === "delete_school") {
      const { id } = body;
      if (!id || typeof id !== "string") {
        return NextResponse.json({ success: false, error: "Missing school id" }, { status: 400 });
      }

      // First verify school exists
      const { data: school, error: fetchErr } = await admin
        .from("schools")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr || !school) {
        return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
      }

      // Delete school — cascades to all related data
      const { error } = await admin.from("schools").delete().eq("id", id);
      if (error) {
        logger.error("[actions] delete_school error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    logger.error("[actions] unhandled error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
