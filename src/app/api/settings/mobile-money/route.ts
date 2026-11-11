import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
  handleApiError,
  requireUserWithSchool,
} from "@/lib/api-utils";
import {
  createParentMobileMoneyProviderClient,
  requiredProviderSecretFields,
  type AirtelProviderSecrets,
  type MtnProviderSecrets,
  type ParentMobileMoneyProvider,
  type ProviderEnvironment,
} from "@/lib/payments/provider-client";
import {
  decryptProviderCredentials,
  encryptProviderCredentials,
  paymentCredentialsEncryptionReady,
} from "@/lib/payments/credential-vault";

export const dynamic = "force-dynamic";

const CONFIG_ROLES = ["school_admin", "admin", "headmaster", "bursar"];
const VALID_PROVIDERS = new Set<ParentMobileMoneyProvider>(["mtn", "airtel"]);
const VALID_ENVIRONMENTS = new Set<ProviderEnvironment>(["sandbox", "production"]);

type ConfigRow = {
  provider: ParentMobileMoneyProvider;
  environment: ProviderEnvironment;
  credentials_ciphertext: string;
  enabled: boolean;
  verified_at: string | null;
};

function checkConfigRole(role: string) {
  return assertUserRoleOrDeny({ userRole: role, allowedRoles: CONFIG_ROLES });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = checkConfigRole(auth.context.user.role);
    if (!roleCheck.ok) return roleCheck.response;
    if (!auth.context.schoolId) return apiError("School context is required", 403);

    const supabase = createServiceRoleClientOrThrow();
    const { data, error } = await supabase
      .from("school_payment_provider_configs")
      .select("provider, environment, enabled, verified_at")
      .eq("school_id", auth.context.schoolId);
    if (error) throw error;

    const rows = (data || []) as Array<Pick<ConfigRow, "provider" | "environment" | "enabled" | "verified_at">>;
    const providers = Object.fromEntries(
      (["mtn", "airtel"] as const).map((provider) => {
        const row = rows.find((item) => item.provider === provider);
        return [
          provider,
          {
            configured: Boolean(row),
            enabled: Boolean(row?.enabled && row.environment === "production"),
            environment: row?.environment ?? "sandbox",
            verifiedAt: row?.verified_at ?? null,
          },
        ];
      }),
    );

    return apiSuccess({ providers, encryptionReady: paymentCredentialsEncryptionReady() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = checkConfigRole(auth.context.user.role);
    if (!roleCheck.ok) return roleCheck.response;
    if (!auth.context.schoolId) return apiError("School context is required", 403);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const provider = typeof body.provider === "string" ? body.provider : "";
    const action = body.action === "disable" ? "disable" : body.action === "test" ? "test" : "save";
    if (!VALID_PROVIDERS.has(provider as ParentMobileMoneyProvider)) return apiError("Choose MTN or Airtel Money", 400);

    const providerName = provider as ParentMobileMoneyProvider;
    if (action === "disable") {
      const supabase = createServiceRoleClientOrThrow();
      const { error } = await supabase
        .from("school_payment_provider_configs")
        .update({ enabled: false, updated_by: auth.context.user.id, updated_at: new Date().toISOString() })
        .eq("school_id", auth.context.schoolId)
        .eq("provider", providerName);
      if (error) throw error;
      return apiSuccess({ provider: providerName, enabled: false }, "In-app collections turned off.");
    }

    const environment = body.environment === "production" ? "production" : "sandbox";
    if (!VALID_ENVIRONMENTS.has(environment)) return apiError("Choose a valid payment environment", 400);
    const rawCredentials = (body.credentials && typeof body.credentials === "object" ? body.credentials : {}) as Record<
      string,
      unknown
    >;

    const supabase = createServiceRoleClientOrThrow();
    const { data: stored, error: storedError } = await supabase
      .from("school_payment_provider_configs")
      .select("provider, environment, credentials_ciphertext, enabled, verified_at")
      .eq("school_id", auth.context.schoolId)
      .eq("provider", providerName)
      .maybeSingle();
    if (storedError) throw storedError;

    let credentials: Record<string, string> = {};
    // Sandbox and production merchant credentials are distinct. Never fill
    // blanks in one environment with secrets saved for the other.
    if (stored?.credentials_ciphertext && stored.environment === environment) {
      credentials = decryptProviderCredentials<Record<string, string>>(stored.credentials_ciphertext);
    }
    for (const field of requiredProviderSecretFields(providerName)) {
      const value = typeof rawCredentials[field] === "string" ? rawCredentials[field].trim() : "";
      if (value) credentials[field] = value;
      if (!credentials[field]) return apiError(`Enter the ${field} for this provider`, 400);
    }

    const client = createParentMobileMoneyProviderClient(
      providerName,
      environment,
      providerName === "mtn" ? (credentials as MtnProviderSecrets) : (credentials as AirtelProviderSecrets),
    );
    try {
      await client.testConnection();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider connection failed.";
      return apiError(message, 400);
    }

    if (action === "test") {
      return apiSuccess(
        { provider: providerName, environment, connected: true },
        "Connection verified. No payment request was made.",
      );
    }

    if (!paymentCredentialsEncryptionReady()) {
      return apiError("Secure payment credential storage is not configured on this server.", 503);
    }

    const enabled = environment === "production" && body.enableLive === true;
    if (enabled && body.callbackConfigurationConfirmed !== true) {
      return apiError(
        "Register SkoolMate's payment callback URL with the provider before enabling live collections.",
        400,
      );
    }
    const ciphertext = encryptProviderCredentials(credentials);
    const { error } = await supabase.from("school_payment_provider_configs").upsert(
      {
        school_id: auth.context.schoolId,
        provider: providerName,
        environment,
        credentials_ciphertext: ciphertext,
        enabled,
        verified_at: new Date().toISOString(),
        created_by: auth.context.user.id,
        updated_by: auth.context.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,provider" },
    );
    if (error) throw error;

    return apiSuccess(
      { provider: providerName, environment, enabled },
      enabled ? "Provider saved and in-app payments enabled." : "Provider connection saved. Live collections are off.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
