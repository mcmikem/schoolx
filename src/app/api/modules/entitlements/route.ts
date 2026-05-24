import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";
import { getAnnualModulePrice, type ModuleKey } from "@/lib/modules/catalog";

const MODULE_ADMIN_ROLES = [
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
  "bursar",
];

function normalizeSizeBand(value: unknown): "small" | "medium" | "large" {
  if (value === "medium" || value === "large") return value;
  return "small";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    if (!auth.context.schoolId) return apiError("School context required", 403);

    const supabase = createServiceRoleClientOrThrow();

    const [{ data: school, error: schoolError }, { data: catalog, error: catalogError }, { data: entitlements, error: entitlementError }] = await Promise.all([
      supabase
        .from("schools")
        .select("id, billing_mode, school_size_band")
        .eq("id", auth.context.schoolId)
        .maybeSingle(),
      supabase
        .from("module_catalog")
        .select("module_key, display_name, description, annual_price_small, annual_price_medium, annual_price_large, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("school_module_entitlements")
        .select("module_key, status, starts_at, ends_at, auto_renew")
        .eq("school_id", auth.context.schoolId),
    ]);

    if (schoolError || !school) {
      return apiError("School not found", 404);
    }
    if (catalogError) {
      return apiError("Failed to load module catalog", 500);
    }
    if (entitlementError) {
      return apiError("Failed to load entitlements", 500);
    }

    const sizeBand = normalizeSizeBand((school as Record<string, unknown>).school_size_band);
    const normalizedCatalog = (catalog || []).map((item: any) => ({
      ...item,
      annual_price_ugx: getAnnualModulePrice(item, sizeBand),
    }));

    return apiSuccess({
      school: {
        billing_mode: (school as Record<string, unknown>).billing_mode || "full_suite",
        school_size_band: sizeBand,
      },
      catalog: normalizedCatalog,
      entitlements: entitlements || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: MODULE_ADMIN_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    if (!auth.context.schoolId) {
      return apiError("School context required", 403);
    }

    const { moduleKey, autoRenew = true } = (await request.json()) as {
      moduleKey?: ModuleKey;
      autoRenew?: boolean;
    };

    if (!moduleKey) {
      return apiError("moduleKey is required", 400);
    }

    const supabase = createServiceRoleClientOrThrow();

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, billing_mode, school_size_band")
      .eq("id", auth.context.schoolId)
      .maybeSingle();

    if (schoolError || !school) {
      return apiError("School not found", 404);
    }

    const billingMode = (school as Record<string, unknown>).billing_mode || "full_suite";
    if (billingMode !== "modular") {
      return apiError(
        "This school is currently on full suite. Switch to modular mode first.",
        409,
      );
    }

    const { data: moduleItem, error: moduleError } = await supabase
      .from("module_catalog")
      .select("module_key, display_name, annual_price_small, annual_price_medium, annual_price_large, is_active")
      .eq("module_key", moduleKey)
      .maybeSingle();

    if (moduleError || !moduleItem || !moduleItem.is_active) {
      return apiError("Module not found", 404);
    }

    const sizeBand = normalizeSizeBand((school as Record<string, unknown>).school_size_band);
    const annualAmount = getAnnualModulePrice(moduleItem as any, sizeBand);

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    const { error: entitlementError } = await supabase
      .from("school_module_entitlements")
      .upsert(
        {
          school_id: auth.context.schoolId,
          module_key: moduleKey,
          status: "active",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          auto_renew: Boolean(autoRenew),
          source: "purchase",
          created_by: auth.context.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id,module_key" },
      );

    if (entitlementError) {
      return apiError("Failed to activate module", 500);
    }

    const { error: purchaseError } = await supabase
      .from("school_module_purchases")
      .insert({
        school_id: auth.context.schoolId,
        module_key: moduleKey,
        amount_ugx: annualAmount,
        billing_period: "annual",
        purchase_status: "paid",
        payment_provider: "manual",
        payment_reference: `manual-${Date.now()}`,
        purchased_by: auth.context.user.id,
        purchased_at: startsAt.toISOString(),
        valid_until: endsAt.toISOString(),
        notes: "Activated via modules settings",
      });

    if (purchaseError) {
      return apiError("Module activated but purchase record failed", 500);
    }

    return apiSuccess(
      {
        module_key: moduleKey,
        amount_ugx: annualAmount,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      },
      "Module activated successfully",
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
