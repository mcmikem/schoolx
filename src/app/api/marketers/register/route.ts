import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError, requireAuthenticatedUser, withRateLimit } from "@/lib/api-utils";
import { PRIMARY_TEMPLATE, SECONDARY_TEMPLATE } from "@/lib/curriculum-templates";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { buildUgandaAcademicTerms, buildUgandaCalendarEvents } from "@/lib/uganda-school-calendar";
import { normalizeAuthPhone } from "@/lib/validation";
import { buildDefaultClasses, type SchoolSetupType } from "@/lib/school-setup";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function generateSchoolCode(schoolName: string, district: string): string {
  const nameWords = schoolName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  let nameCode = "";
  for (const word of nameWords.slice(0, 3)) {
    nameCode += word.substring(0, 2);
    if (nameCode.length >= 4) break;
  }
  nameCode = nameCode.substring(0, 4) || "SCHL";
  const districtCode =
    district
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .substring(0, 2) || "UG";
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${nameCode}${districtCode}${randomNum}`;
}

function getDefaultSubjects(schoolType: string) {
  if (schoolType === "primary") return PRIMARY_TEMPLATE.subjects;
  if (schoolType === "secondary") return SECONDARY_TEMPLATE.subjects;
  const combined = [...PRIMARY_TEMPLATE.subjects];
  SECONDARY_TEMPLATE.subjects.forEach((s) => {
    if (!combined.find((c) => c.code === s.code && c.level === s.level)) {
      combined.push(s);
    }
  });
  return combined;
}

export const POST = withRateLimit(
  async (request: NextRequest) => {
    const rollbacks: Array<() => Promise<void>> = [];
    async function rollbackAll() {
      const errors: unknown[] = [];
      for (let i = rollbacks.length - 1; i >= 0; i--) {
        try {
          await rollbacks[i]();
        } catch (e) {
          errors.push(e);
        }
      }
      if (errors.length > 0) logger.error("[Marketer Register] Rollback errors:", errors);
    }

    try {
      const auth = await requireAuthenticatedUser(request);
      if (!auth.ok) return auth.response;

      if (!supabaseServiceKey) {
        return apiError("Server configuration error", 500);
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Get marketer profile
      const { data: profile } = await withTimeout(
        supabaseAdmin.from("users").select("id, role").eq("auth_id", auth.context.authUserId).maybeSingle(),
        10000,
        timeoutFallback(),
      );

      if (!profile || profile.role !== "marketer") {
        return apiError("Forbidden: only marketers can use this endpoint", 403);
      }

      const body = await request.json();
      const {
        schoolName,
        district,
        subcounty,
        parish,
        village,
        schoolType,
        ownership,
        selectedPackage,
        adminName,
        adminPhone,
        password,
        phone,
        email,
      } = body;

      if (
        !schoolName?.trim() ||
        !district?.trim() ||
        !subcounty?.trim() ||
        !adminName?.trim() ||
        !adminPhone?.trim() ||
        !password
      ) {
        return apiError("All required fields must be filled", 400);
      }

      if (schoolName.trim().length < 3) return apiError("School name must be at least 3 characters", 400);
      if (adminName.trim().length < 2) return apiError("Admin name must be at least 2 characters", 400);
      if (password.length < 8) return apiError("Password must be at least 8 characters", 400);
      if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return apiError("Password must contain at least one uppercase letter and one number", 400);
      }

      const normalizedPhone = normalizeAuthPhone(adminPhone);
      if (normalizedPhone.length < 10 || normalizedPhone.length > 12) {
        return apiError("Invalid phone number format. Use Uganda format (e.g., 0700000000)", 400);
      }

      const subscriptionPlan = normalizePlanType(selectedPackage || "basic");

      // Check existing user
      const { data: existingUser } = await withTimeout(
        supabaseAdmin.from("users").select("id").eq("phone", normalizedPhone).maybeSingle(),
        10000,
        timeoutFallback(),
      );

      if (existingUser) {
        return apiError("This phone number is already registered. Ask the admin to sign in.", 400);
      }

      // Generate unique school code
      let schoolCode = generateSchoolCode(schoolName, district);
      schoolCode = schoolCode + Date.now().toString(36).slice(-2).toUpperCase();
      let codeAttempts = 0;
      while (codeAttempts < 10) {
        const { data: existingSchool } = await withTimeout(
          supabaseAdmin.from("schools").select("id").eq("school_code", schoolCode).maybeSingle(),
          5000,
          timeoutFallback(),
        );
        if (!existingSchool) break;
        schoolCode = generateSchoolCode(schoolName, district);
        codeAttempts++;
      }
      if (codeAttempts >= 10) return apiError("Unable to generate unique school code. Please try again.", 400);

      // Create auth user
      const hasValidEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
      const emailForAuth = hasValidEmail ? email.trim().toLowerCase() : `${normalizedPhone}@omuto.org`;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailForAuth,
        password,
        email_confirm: true,
        user_metadata: { full_name: adminName, phone: normalizedPhone, role: "school_admin" },
      });

      if (authError) {
        if (
          authError.message.includes("already registered") ||
          authError.message.includes("duplicate") ||
          authError.message.includes("already exists") ||
          authError.message.includes("already taken")
        ) {
          return apiError("This account already exists. Ask the admin to sign in.", 400);
        }
        throw authError;
      }
      rollbacks.push(async () => {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      });

      // Create school with onboarded_by
      const { data: schoolData, error: schoolError } = await withTimeout(
        supabaseAdmin
          .from("schools")
          .insert({
            name: schoolName,
            school_code: schoolCode,
            district,
            subcounty,
            parish: parish || null,
            village: village || null,
            school_type: schoolType,
            ownership: ownership || "private",
            phone: phone || null,
            email: email || null,
            subscription_plan: subscriptionPlan,
            subscription_status: "trial",
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            primary_color: "#1e3a5f",
            onboarded_by: profile.id,
          })
          .select()
          .maybeSingle(),
        15000,
        timeoutFallback(),
      );

      if (schoolError) throw schoolError;
      rollbacks.push(async () => {
        await supabaseAdmin.from("schools").delete().eq("id", schoolData.id);
      });

      // Create user record
      const { error: userError } = await withTimeout(
        supabaseAdmin.from("users").insert({
          auth_id: authData.user.id,
          school_id: schoolData.id,
          full_name: adminName,
          phone: normalizedPhone,
          email: hasValidEmail ? email.trim().toLowerCase() : null,
          role: "school_admin",
          is_active: true,
        }),
        10000,
        timeoutFallback(),
      );

      if (userError) throw userError;

      // Seed curriculum
      try {
        const currentYear = new Date().getFullYear().toString();
        const defaultSubjects = getDefaultSubjects(schoolType);
        if (defaultSubjects.length > 0) {
          await withTimeout(
            supabaseAdmin.from("subjects").insert(
              defaultSubjects.map((s) => ({
                school_id: schoolData.id,
                name: s.name,
                code: s.code,
                level: s.level,
                is_compulsory: s.is_compulsory,
              })),
            ),
            15000,
            timeoutFallback(),
          );
        }

        const defaultClasses = buildDefaultClasses(schoolData.id, schoolType as SchoolSetupType, currentYear);
        if (defaultClasses.length > 0) {
          await withTimeout(supabaseAdmin.from("classes").insert(defaultClasses), 15000, timeoutFallback());
        }

        const { data: academicYear } = await withTimeout(
          supabaseAdmin
            .from("academic_years")
            .insert({ school_id: schoolData.id, year: currentYear, is_current: true })
            .select()
            .maybeSingle(),
          10000,
          timeoutFallback(),
        );

        if (academicYear) {
          const terms = buildUgandaAcademicTerms(schoolData.id, currentYear);
          await withTimeout(
            supabaseAdmin.from("academic_terms").upsert(
              terms.map((t) => ({ ...t, academic_year_id: academicYear.id })),
              { onConflict: "school_id,academic_year,term_number" },
            ),
            15000,
            timeoutFallback(),
          );
        }

        await withTimeout(
          supabaseAdmin.from("events").insert(buildUgandaCalendarEvents(schoolData.id, currentYear)),
          15000,
          timeoutFallback(),
        );
      } catch (setupError) {
        logger.error("[Marketer Register] Auto-setup failed, rolling back:", setupError);
        await rollbackAll();
        return apiError("Registration could not be completed. Please try again.", 500);
      }

      // ── Auto-create commission earnings ──────────────────────────────────────
      const isPaid = subscriptionPlan !== "free_trial";
      const isPremium = subscriptionPlan === "growth" || subscriptionPlan === "enterprise";
      const commissionAmount = isPaid ? (isPremium ? 80000 : 70000) : 4000;

      try {
        await withTimeout(
          supabaseAdmin.from("marketer_earnings").insert({
            marketer_id: profile.id,
            school_id: schoolData.id,
            earning_type: "onboarding_bonus",
            amount: commissionAmount,
            currency: "UGX",
            status: "pending",
            notes: `Auto-created: ${isPaid ? `${subscriptionPlan} plan (${isPremium ? "premium" : "standard"})` : "free trial"} registration`,
          }),
          10000,
          timeoutFallback(),
        );

        // Optional digitization fee
        const digitizationFee = Number(body.digitizationFee) || 0;
        if (digitizationFee >= 10000 && digitizationFee <= 50000) {
          await withTimeout(
            supabaseAdmin.from("marketer_earnings").insert({
              marketer_id: profile.id,
              school_id: schoolData.id,
              earning_type: "digitization_fee",
              amount: digitizationFee,
              currency: "UGX",
              status: "pending",
              notes: body.digitizationFeeNotes || "Student data digitization service",
            }),
            10000,
            timeoutFallback(),
          );
        }
      } catch (earningsError) {
        logger.error("[Marketer Register] Failed to auto-create earnings, non-fatal:", earningsError);
      }

      return apiSuccess(
        {
          schoolId: schoolData.id,
          schoolCode,
          commission: commissionAmount,
          adminPhone: normalizedPhone,
          adminEmail: emailForAuth,
        },
        "School registered successfully. The admin can sign in with the phone number and password you set.",
        201,
      );
    } catch (error) {
      logger.error("[Marketer Register] Error:", error);
      await rollbackAll();
      return handleApiError(error);
    }
  },
  20,
  60000,
);
