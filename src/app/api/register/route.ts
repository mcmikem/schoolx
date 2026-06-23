// ============================================================================
// 🔒 LOCKED DOWN — REGISTER API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Server-side registration with Supabase admin client. Creates auth user,
// school record, user profile, and seeds curriculum data.
//
// Last audited: 2026-05-12 | Known pitfalls:
//   - Uses supabaseAdmin (service role) — bypasses RLS
//   - Manual rollback on failure (delete auth user + school)
//   - School code generation must include timestamp to avoid race conditions
//   - Honeypot field (_gotcha) for bot protection
//   - Rate limit: 5 registrations per IP per 10 minutes
//   - Auth email: user-provided email OR ${phone}@omuto.org fallback
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  apiSuccess,
  apiError,
  handleApiError,
  rateLimit,
} from "@/lib/api-utils";
import {
  PRIMARY_TEMPLATE,
  SECONDARY_TEMPLATE,
} from "@/lib/curriculum-templates";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import {
  buildUgandaAcademicTerms,
  buildUgandaCalendarEvents,
} from "@/lib/uganda-school-calendar";
import { normalizeAuthPhone } from "@/lib/validation";
import { buildDefaultClasses, type SchoolSetupType } from "@/lib/school-setup";
import { logger } from "@/lib/logger";
import { type ModuleKey } from "@/lib/modules/catalog";
import { generateWhatsAppShareLink } from "@/lib/whatsapp";
import { PLATFORM_SUPPORT_PHONE } from "@/lib/support-contact";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Get default subjects based on school type
function getDefaultSubjects(schoolType: string) {
  if (schoolType === "primary") return PRIMARY_TEMPLATE.subjects;
  if (schoolType === "secondary") return SECONDARY_TEMPLATE.subjects;

  // Combined - merge both, avoiding duplicates by code
  const combined = [...PRIMARY_TEMPLATE.subjects];
  SECONDARY_TEMPLATE.subjects.forEach((s) => {
    if (!combined.find((c) => c.code === s.code && c.level === s.level)) {
      combined.push(s);
    }
  });
  return combined;
}

interface RegisterRequest {
  schoolName: string;
  district: string;
  subcounty: string;
  parish?: string;
  village?: string;
  schoolType: "primary" | "secondary" | "combined";
  ownership: "private" | "government" | "government_aided";
  selectedPackage?: string;
  billingMode?: "full_suite" | "modular";
  selectedModules?: ModuleKey[];
  phone?: string;
  email?: string;
  adminName: string;
  adminPhone: string;
  password: string;
}

const REGISTRATION_MODULE_KEYS: ModuleKey[] = [
  "reports",
  "students",
  "canteen",
  "finance",
  "attendance",
  "communications",
];

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || PLATFORM_SUPPORT_PHONE;

function normalizeSelectedModules(raw: unknown): ModuleKey[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<ModuleKey>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const moduleKey = value as ModuleKey;
    if (REGISTRATION_MODULE_KEYS.includes(moduleKey)) {
      unique.add(moduleKey);
    }
  }
  return Array.from(unique);
}

function formatModuleRequestMessage(params: {
  schoolName: string;
  schoolCode: string;
  district: string;
  adminName: string;
  adminPhone: string;
  selectedPackage: string;
  modules: ModuleKey[];
}) {
  const moduleList = params.modules.join(", ") || "none";
  return [
    "Hello Super Admin,",
    "",
    "Please activate modules after in-person payment confirmation:",
    `School: ${params.schoolName}`,
    `School Code: ${params.schoolCode}`,
    `District: ${params.district}`,
    `Admin: ${params.adminName} (${params.adminPhone})`,
    `Plan: ${params.selectedPackage}`,
    `Requested Modules: ${moduleList}`,
  ].join("\n");
}

// Generate a unique school code based on school name and district
function generateSchoolCode(schoolName: string, district: string): string {
  // Get first 2 letters of each word in school name (max 4 letters)
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

  // Get first 2 letters of district
  const districtCode =
    district
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .substring(0, 2) || "UG";

  // Generate random 3-digit number
  const randomNum = Math.floor(100 + Math.random() * 900);

  return `${nameCode}${districtCode}${randomNum}`;
}

export async function POST(request: NextRequest) {
  logger.debug("[Register] START - Processing registration request");
  try {
    // Rate limit: 5 registrations per IP per 10 minutes
    logger.debug("[Register] Step 1: Checking rate limit");
    const { success } = rateLimit(request, 5, 600_000);
    if (!success) {
      logger.debug("[Register] Rate limited");
      return apiError(
        "Too many registration attempts. Please try again later.",
        429,
      );
    }

    if (!supabaseServiceKey) {
      logger.debug("[Register] ERROR: SUPABASE_SERVICE_ROLE_KEY not set");
      return apiError(
        "Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set",
        500,
      );
    }
    logger.debug("[Register] Step 2: Parsing request body");

    const body: RegisterRequest & { _gotcha?: string } = await request.json();
    const {
      schoolName,
      district,
      subcounty,
      parish,
      village,
      schoolType,
      ownership,
      selectedPackage,
      billingMode,
      selectedModules,
      phone,
      email,
      adminName,
      adminPhone,
      password,
      _gotcha,
    } = body;

    // Honeypot: bots fill hidden fields; humans leave them blank
    if (_gotcha) {
      // Silently reject with a 200 so bots don't know they were blocked
      return apiSuccess({ message: "Registration received." });
    }

    // Validate required fields
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

    // Input length limits to prevent oversized payloads
    if (schoolName.trim().length > 200) return apiError("School name is too long", 400);
    if (district.trim().length > 100) return apiError("District name is too long", 400);
    if (subcounty.trim().length > 100) return apiError("Sub-county is too long", 400);
    if (adminName.trim().length > 200) return apiError("Admin name is too long", 400);
    if (parish && parish.trim().length > 100) return apiError("Parish is too long", 400);
    if (village && village.trim().length > 100) return apiError("Village is too long", 400);
    if (password.length > 128) return apiError("Password is too long", 400);
    if (email && email.length > 254) return apiError("Email is too long", 400);

    const subscriptionPlan = normalizePlanType(selectedPackage || "basic");
    const normalizedBillingMode =
      billingMode === "modular" ? "modular" : "full_suite";
    const normalizedModules = normalizeSelectedModules(selectedModules);
    const modulesToSeed: ModuleKey[] =
      normalizedBillingMode === "modular"
        ? (normalizedModules.length > 0 ? normalizedModules : (["reports", "attendance"] as ModuleKey[]))
        : [];

    if (schoolName.trim().length < 3) {
      return apiError("School name must be at least 3 characters", 400);
    }

    if (adminName.trim().length < 2) {
      return apiError("Admin name must be at least 2 characters", 400);
    }

    if (password.length < 8) {
      return apiError(
        "Password must be at least 8 characters with one uppercase letter and one number",
        400,
      );
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return apiError(
        "Password must contain at least one uppercase letter and one number",
        400,
      );
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError("Invalid email format", 400);
    }

    // Normalize phone number (remove spaces, dashes, keep only digits)
    logger.debug("[Register] Step 3: Normalizing phone");
    const normalizedPhone = normalizeAuthPhone(adminPhone);

    if (normalizedPhone.length < 10 || normalizedPhone.length > 12) {
      return apiError(
        "Invalid phone number format. Please use Uganda format (e.g., 0700000000)",
        400,
      );
    }

    // Create admin client (bypasses RLS)
    logger.debug("[Register] Step 4: Creating Supabase admin client");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Check if phone number already exists
    logger.debug("[Register] Step 5: Checking existing user in DB");
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", normalizedPhone)
      .single();

    if (existingUser) {
      return apiError(
        "Registration could not be completed. If you already have an account, please sign in.",
        400,
      );
    }

    // 2. Generate unique school code
    // Generate unique school code with timestamp component to avoid race conditions
    let schoolCode = generateSchoolCode(schoolName, district);
    schoolCode = schoolCode + Date.now().toString(36).slice(-2).toUpperCase();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existingSchool } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("school_code", schoolCode)
        .single();

      if (!existingSchool) break;

      // Generate new code if collision
      schoolCode = generateSchoolCode(schoolName, district);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return apiError(
        "Unable to generate unique school code. Please try again.",
        400,
      );
    }

    // 3. Create auth user using admin client
    const normalizedEmail = email?.trim().toLowerCase();
    const hasValidProvidedEmail =
      !!normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    const emailForAuth = hasValidProvidedEmail
      ? normalizedEmail
      : `${normalizedPhone}@omuto.org`;
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailForAuth,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: adminName,
          phone: normalizedPhone,
          role: "school_admin",
        },
      });

    if (authError) {
      // Check if it's a duplicate email error
      if (
        authError.message.includes("already registered") ||
        authError.message.includes("duplicate")
      ) {
        return apiError(
          "Registration could not be completed. If you already have an account, please sign in.",
          400,
        );
      }
      throw authError;
    }

    // 4. Create school record
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: schoolName,
        school_code: schoolCode,
        district,
        subcounty,
        parish: parish || null,
        village: village || null,
        school_type: schoolType,
        ownership,
        phone: phone || null,
        email: email || null,
        subscription_plan: subscriptionPlan,
        billing_mode: normalizedBillingMode,
        subscription_status: "trial",
        trial_ends_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        primary_color: "#1e3a5f",
      })
      .select()
      .single();

    if (schoolError) {
      // Cleanup: delete auth user if school creation fails
      if (authData?.user) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteErr) {
          logger.error("[Register] Failed to cleanup auth user:", deleteErr);
        }
      }
      throw schoolError;
    }

    // 5. Create user record
    const { data: createdUser, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        auth_id: authData.user.id,
        school_id: schoolData.id,
        full_name: adminName,
        phone: normalizedPhone,
        email: normalizedEmail || null,
        role: "school_admin",
        is_active: true,
      })
      .select("id")
      .single();

    if (userError) {
      // Cleanup: delete auth user and school if user creation fails
      const cleanupErrors: Error[] = [];
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (deleteErr) {
        cleanupErrors.push(deleteErr instanceof Error ? deleteErr : new Error(String(deleteErr)));
      }
      try {
        await supabaseAdmin.from("schools").delete().eq("id", schoolData.id);
      } catch (deleteErr) {
        cleanupErrors.push(deleteErr instanceof Error ? deleteErr : new Error(String(deleteErr)));
      }
      if (cleanupErrors.length > 0) {
        logger.error("[Register] Cleanup errors:", cleanupErrors);
      }
      throw userError;
    }

    let moduleRequestLink: string | null = null;
    let moduleRequestMessage: string | null = null;

    if (normalizedBillingMode === "modular") {
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 30);

      const entitlementRows = modulesToSeed.map((moduleKey) => ({
        school_id: schoolData.id,
        module_key: moduleKey,
        status: "pending",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        auto_renew: false,
        source: "manual_confirmation",
        created_by: createdUser.id,
        updated_at: new Date().toISOString(),
      }));

      const { error: entitlementError } = await supabaseAdmin
        .from("school_module_entitlements")
        .upsert(entitlementRows, { onConflict: "school_id,module_key" });

      if (entitlementError) {
        // Cleanup: delete auth user and school if entitlement request creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteErr) {
          logger.error("[Register] Failed to cleanup auth user:", deleteErr);
        }
        try {
          await supabaseAdmin.from("schools").delete().eq("id", schoolData.id);
        } catch (deleteErr) {
          logger.error("[Register] Failed to cleanup school:", deleteErr);
        }
        throw entitlementError;
      }

      const message = formatModuleRequestMessage({
        schoolName,
        schoolCode,
        district,
        adminName,
        adminPhone: normalizedPhone,
        selectedPackage: subscriptionPlan,
        modules: modulesToSeed,
      });
      moduleRequestMessage = message;
      moduleRequestLink = generateWhatsAppShareLink(SUPPORT_WHATSAPP, message);

      const { error: ticketError } = await supabaseAdmin.from("support_tickets").insert({
        school_id: schoolData.id,
        type: "custom_package",
        title: "Module activation request pending payment",
        description: message,
        priority: "medium",
        status: "open",
      });

      if (ticketError) {
        logger.warn("[Register] Failed to create support ticket for module request:", ticketError);
      }
    }

    // 6. Auto-seed essential curriculum data
    // Run setup and await it so the serverless function doesn't terminate and kill the process.
    try {
      const currentYear = new Date().getFullYear().toString();

      // Create subjects
      const defaultSubjects = getDefaultSubjects(schoolType);
      if (defaultSubjects.length > 0) {
        const subjectRecords = defaultSubjects.map((s) => ({
          school_id: schoolData.id,
          name: s.name,
          code: s.code,
          level: s.level,
          is_compulsory: s.is_compulsory,
        }));
        const { error: subjectsError } = await supabaseAdmin
          .from("subjects")
          .insert(subjectRecords);
        if (subjectsError) {
          logger.warn("[Setup] Subjects seed failed:", subjectsError);
        }
      }

      // Create classes
      const defaultClasses = buildDefaultClasses(
        schoolData.id,
        schoolType as SchoolSetupType,
        currentYear,
      );
      if (defaultClasses.length > 0) {
        const { error: classesError } = await supabaseAdmin
          .from("classes")
          .insert(defaultClasses);
        if (classesError) {
          logger.warn("[Setup] Classes seed failed:", classesError);
        }
      }

      // Create academic year
      const { data: academicYear, error: ayError } = await supabaseAdmin
        .from("academic_years")
        .insert({
          school_id: schoolData.id,
          year: `${currentYear}`,
          is_current: true,
        })
        .select()
        .single();

      if (ayError) {
        logger.warn("[Setup] Academic year seed failed:", ayError);
      }

      // Create terms
      if (academicYear) {
        const defaultAcademicTerms = buildUgandaAcademicTerms(
          schoolData.id,
          currentYear,
        );
        const defaultTermRows = defaultAcademicTerms.map((term) => ({
          school_id: schoolData.id,
          academic_year_id: academicYear.id,
          term_number: term.term_number,
          start_date: term.start_date,
          end_date: term.end_date,
          is_current: term.is_current,
        }));

        const { error: termsError } = await supabaseAdmin
          .from("terms")
          .insert(defaultTermRows);
        if (termsError) {
          logger.warn("[Setup] Terms seed failed:", termsError);
        }

        const { error: atError } = await supabaseAdmin
          .from("academic_terms")
          .upsert(defaultAcademicTerms, {
            onConflict: "school_id,academic_year,term_number",
          });
        if (atError) {
          logger.warn("[Setup] Academic terms upsert failed:", atError);
        }
      }

      const { error: eventsError } = await supabaseAdmin
        .from("events")
        .insert(buildUgandaCalendarEvents(schoolData.id, currentYear));
      if (eventsError) {
        logger.warn("[Setup] Events seed failed:", eventsError);
      }

      // Setup complete
      if (process.env.NODE_ENV !== "production") {
        logger.debug("[Setup] Auto-setup completed for new school");
      }
    } catch (setupError) {
      logger.error("[Setup] Auto-setup failed:", setupError);
    }

    // Return success
    return apiSuccess(
      {
        schoolId: schoolData.id,
        userId: authData.user.id,
        schoolCode,
        moduleRequestLink,
        moduleRequestMessage,
      },
      "Registration successful",
    );
  } catch (error) {
    logger.error("[Register Error]", error);
    // Provide more specific error messages for common database issues
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        msg.includes("already exists")
      ) {
        return apiError(
          "Registration could not be completed. If you already have an account, please sign in.",
          400,
        );
      }
      if (msg.includes("relation") || msg.includes("does not exist")) {
        return apiError(
          "Database setup incomplete. Please contact support.",
          500,
        );
      }
      if (
        msg.includes("permission") ||
        msg.includes("rls") ||
        msg.includes("policy")
      ) {
        return apiError(
          "Server configuration error. Please contact support.",
          500,
        );
      }
    }
    return handleApiError(error);
  }
}
