// ============================================================================
// 🔒 LOCKED DOWN — OAUTH REGISTER API (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Google OAuth registration flow. Links Google auth to school account.
//
// Last audited: 2026-05-12 | Known pitfalls:
//   - Requires authenticated Google session (checks supabase.auth.getUser())
//   - Uses school-provisioning helpers (reserveUniqueSchoolCode, seedSchoolDefaults)
//   - Checks for existing auth_id AND phone to prevent duplicates
//   - Updates auth user metadata after registration
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, rateLimit } from "@/lib/api-utils";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import { normalizeAuthPhone } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import {
  reserveUniqueSchoolCode,
  seedSchoolDefaults,
} from "@/lib/server/school-provisioning";
import { logger } from "@/lib/logger";
import { type ModuleKey } from "@/lib/modules/catalog";
import { generateWhatsAppShareLink } from "@/lib/whatsapp";

interface OAuthRegisterRequest {
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
}

const REGISTRATION_MODULE_KEYS: ModuleKey[] = [
  "reports",
  "student_id",
  "canteen",
  "fees",
  "attendance",
  "messages",
];

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "256700000000";

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

export async function POST(request: NextRequest) {
  try {
    const { success } = rateLimit(request, 5, 600_000);
    if (!success) {
      return apiError("Too many registration attempts. Please try again later.", 429);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return apiError("Please sign in with Google first", 401);
    }

    const body = (await request.json()) as OAuthRegisterRequest;
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
    } = body;

    if (
      !schoolName?.trim() ||
      !district?.trim() ||
      !subcounty?.trim() ||
      !adminName?.trim() ||
      !adminPhone?.trim()
    ) {
      return apiError("All required fields must be filled", 400);
    }

    const normalizedPhone = normalizeAuthPhone(adminPhone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 12) {
      return apiError(
        "Invalid phone number format. Please use Uganda format (e.g., 0700000000)",
        400,
      );
    }

    const subscriptionPlan = normalizePlanType(selectedPackage || "basic");
    const normalizedBillingMode =
      billingMode === "modular" ? "modular" : "full_suite";
    const normalizedModules = normalizeSelectedModules(selectedModules);
    const modulesToSeed: ModuleKey[] =
      normalizedBillingMode === "modular"
        ? (normalizedModules.length > 0 ? normalizedModules : (["reports"] as ModuleKey[]))
        : [];
    const normalizedEmail = (email || authUser.email || "").trim().toLowerCase();

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existingByAuth } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (existingByAuth) {
      return apiError("This Google account is already linked. Please sign in.", 400);
    }

    const { data: existingByPhone } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existingByPhone) {
      return apiError("This phone number is already in use.", 400);
    }

    const schoolCode = await reserveUniqueSchoolCode(
      supabaseAdmin,
      schoolName,
      district,
    );

    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: schoolName,
        district,
        subcounty,
        parish: parish || null,
        village: village || null,
        school_type: schoolType,
        ownership,
        school_code: schoolCode,
        phone: phone || null,
        email: normalizedEmail || null,
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

    if (schoolError || !schoolData) {
      throw schoolError || new Error("Failed to create school");
    }

    const { data: createdUser, error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({
        auth_id: authUser.id,
        school_id: schoolData.id,
        full_name: adminName,
        phone: normalizedPhone,
        email: normalizedEmail || null,
        role: "school_admin",
        is_active: true,
      })
      .select("id")
      .single();

    if (userInsertError) {
      await supabaseAdmin.from("schools").delete().eq("id", schoolData.id);
      throw userInsertError;
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
        await supabaseAdmin.from("schools").delete().eq("id", schoolData.id);
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

      await supabaseAdmin.from("support_tickets").insert({
        school_id: schoolData.id,
        type: "custom_package",
        title: "Module activation request pending payment",
        description: message,
        priority: "medium",
        status: "open",
      });
    }

    await seedSchoolDefaults(supabaseAdmin, schoolData.id, schoolType);

    try {
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          full_name: adminName,
          phone: normalizedPhone,
          role: "school_admin",
          oauth_registered: true,
        },
      });
    } catch (metadataError) {
      logger.warn("OAuth register metadata update failed:", metadataError);
    }

    return apiSuccess({
      message: "Registration successful",
      school: {
        id: schoolData.id,
        name: schoolData.name,
        code: schoolData.school_code,
      },
      moduleRequestLink,
      moduleRequestMessage,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
