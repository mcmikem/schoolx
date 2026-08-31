import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionPlan = "starter" | "growth" | "enterprise" | "lifetime" | "free_trial";
export type SubscriptionStatus = "active" | "trial" | "expired" | "past_due" | "canceled" | "unpaid" | "suspended";
export type FeatureStage = "core" | "academic" | "finance" | "full";

export interface School {
  id: string;
  name: string;
  school_code: string;
  district: string;
  school_type: string;
  ownership: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  primary_color: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  student_count?: number;
  trial_ends_at?: string;
  feature_stage?: FeatureStage;
  is_tester?: boolean;
  created_at: string;
  // Customization fields
  address?: string;
  motto?: string;
  principal_name?: string;
  report_header?: string;
  report_footer?: string;
  id_card_style?: string;
}

export interface UserRow {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  school_id: string | null;
  is_active: boolean;
  created_at: string;
  school_name?: string;
}

export interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  expiredSchools: number;
  totalStudents: number;
  totalUsers: number;
  newThisMonth: number;
}

export type Tab =
  | "overview"
  | "schools"
  | "users"
  | "register"
  | "modules"
  | "marketers"
  | "settings"
  | "audit"
  | "activity";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PLAN_COLORS: Record<string, string> = {
  starter: "#3b82f6",
  growth: "#0d9488",
  enterprise: "#f59e0b",
  lifetime: "#7c3aed",
  free_trial: "#64748b",
};

export const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  lifetime: "Lifetime",
  free_trial: "Free Trial",
};

export const PLAN_PRICES: Record<string, string> = {
  starter: "UGX 2,000/student/term",
  growth: "UGX 3,500/student/term",
  enterprise: "UGX 5,000/student/term",
  lifetime: "One-time license",
  free_trial: "Free",
};

export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#ccfbf1", text: "#0d9488", label: "Active" },
  trial: { bg: "#dbeafe", text: "#1d4ed8", label: "Trial" },
  expired: { bg: "#fee2e2", text: "#dc2626", label: "Expired" },
  past_due: { bg: "#fef3c7", text: "#b45309", label: "Past Due" },
  suspended: { bg: "#fef3c7", text: "#b45309", label: "Suspended" },
  canceled: { bg: "#f1f5f9", text: "#64748b", label: "Canceled" },
  unpaid: { bg: "#fef3c7", text: "#b45309", label: "Unpaid" },
};

export const FEATURE_STAGE_LABELS: Record<FeatureStage, string> = {
  core: "Core Only",
  academic: "Academic",
  finance: "Finance",
  full: "Full Access",
};

export const ROLE_COLORS: Record<string, string> = {
  super_admin: "#7c3aed",
  school_admin: "#0d9488",
  admin: "#0d9488",
  headmaster: "#0369a1",
  bursar: "#b45309",
  teacher: "#16a34a",
  dean_of_studies: "#c026d3",
  secretary: "#64748b",
  dorm_master: "#0891b2",
  parent: "#f59e0b",
  student: "#64748b",
  marketer: "#ec4899",
};

export const ALL_ROLES = [
  "school_admin",
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
  "student",
  "marketer",
];

// ─── API helper ───────────────────────────────────────────────────────────────

export const ADMIN_ACTION_TIMEOUT_MS = 15000;

export async function postAdminAction(payload: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_ACTION_TIMEOUT_MS);

  try {
    return await fetch("/api/super-admin/actions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Check Supabase configuration and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function adminAction(action: string, params: Record<string, unknown>): Promise<void> {
  const res = await postAdminAction({ action, ...params });
  const data = await parseApiResponse(res);
  if (!res.ok || !data.success) {
    throw new Error(typeof data.error === "string" ? data.error : "Operation failed");
  }
}

export async function adminActionResult<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const res = await postAdminAction({ action, ...params });
  const data = await parseApiResponse(res);
  if (!res.ok || !data.success) {
    throw new Error(typeof data.error === "string" ? data.error : "Operation failed");
  }
  return data as T;
}

export async function parseApiResponse(response: Response): Promise<Record<string, any>> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as Record<string, any>;
    } catch (err) {
      logger.warn("parseApiResponse JSON parse failed:", err);
      return {
        success: false,
        error: response.ok ? "Unexpected response from server" : "Server returned invalid JSON",
      };
    }
  }

  const text = await response.text().catch((err) => {
    logger.warn("parseApiResponse text read failed:", err);
    return "";
  });
  const trimmed = text.trim();
  const isHtml = /^<!doctype html|^<html/i.test(trimmed);
  const fallbackMessage = response.ok ? "Unexpected response from server" : "Server returned an unexpected error page";

  return {
    success: false,
    error: isHtml ? fallbackMessage : trimmed.slice(0, 180) || fallbackMessage,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function timeSince(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
