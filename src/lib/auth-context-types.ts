// ============================================================================
// 🔒 LOCKED DOWN — AUTH CONTEXT TYPES (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Type definitions, sanitizers, and trial/subscription checks for auth context.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
"use client";
import type { School, User } from "@/types";
import { DEFAULT_FEATURE_STAGE, FeatureStage } from "./featureStages";
import { normalizePlanType, PlanType } from "./payments/subscription-client";
import { isSubscriptionLapsed, resolveSubscriptionStatus } from "./subscription-state";

export type UserRoleValue =
  | "headmaster"
  | "dean_of_studies"
  | "bursar"
  | "teacher"
  | "student"
  | "parent"
  | "secretary"
  | "dorm_master"
  | "admin"
  | "school_admin"
  | "board"
  | "super_admin"
  | "marketer";

export const DEMO_ALLOWED_ROLES: string[] = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
  "marketer",
  "student",
];

export function sanitizeDemoRole(raw: unknown): User["role"] {
  if (typeof raw === "string" && DEMO_ALLOWED_ROLES.includes(raw)) {
    return raw as User["role"];
  }
  return "teacher";
}

export const DEMO_KEY = "skoolmate_demo_v1";
export const OFFLINE_USER_KEY = "skoolmate_offline_user_v1";
export const OFFLINE_SCHOOL_KEY = "skoolmate_offline_school_v1";
export const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

export interface AuthContextType {
  user: User | null;
  school: School | null;
  loading: boolean;
  authInitialized: boolean;
  isDemo: boolean;
  isTrialExpired: boolean;
  /** True when a valid session exists but the profile/school endpoint was
   *  unreachable (cold start / outage) and a cached/metadata user is active.
   *  The provider retries in the background; treat missing data as transient. */
  profileDegraded: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: any; role?: string }>;
  signUp: (phone: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSchool: () => Promise<void>;
  refreshSchoolFromAPI: () => Promise<void>;
  isSubscriptionActive: () => boolean;
  getSubscriptionPlan: () => PlanType | null;
}

/**
 * Roles that belong to the platform, not to one school.
 *
 * A super admin operates across every school, and a marketer across every
 * market. Neither consumes one school's plan, so neither can be locked out by
 * one school's billing state. Their profiles may still carry a `school_id` --
 * for a super admin it records where they last signed in, not a tenancy -- and
 * reading that school's trial status as if it applied to them showed an
 * expired-plan notice to someone who has no plan.
 */
export const PLATFORM_SCOPED_ROLES: readonly string[] = ["super_admin", "marketer"];

/** True when this role sits outside individual schools. */
export function isPlatformRole(role: string | null | undefined): boolean {
  return !!role && PLATFORM_SCOPED_ROLES.includes(role);
}

export function isSubscriptionActiveCheck(school: School | null, role?: string | null): boolean {
  if (isPlatformRole(role)) return true;
  if (!school) return false;
  if (school.is_tester) return true;
  return resolveSubscriptionStatus(school) === "active";
}

export function getSubscriptionPlan(school: School | null): PlanType | null {
  return school?.subscription_plan ? (normalizePlanType(school.subscription_plan) as PlanType) : null;
}

export function computeTrialExpired(school: School | null, role?: string | null): boolean {
  // Not school-scoped, so not on that school's clock. Checked before the null
  // school so the exemption holds even when no school is loaded at all.
  if (isPlatformRole(role)) return false;
  if (!school) return false;
  if (school.is_tester) return false;
  // Delegated so gating and the super-admin dashboard cannot disagree about the
  // same school. They did once: gating compared trial_ends_at while the
  // dashboard counted the raw status column.
  return isSubscriptionLapsed(school);
}
