// ============================================================================
// 🔒 LOCKED DOWN — AUTH CONTEXT TYPES (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Type definitions, sanitizers, and trial/subscription checks for auth context.
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
"use client";
import { FeatureStage, DEFAULT_FEATURE_STAGE } from "./featureStages";
import type { User, School } from "@/types";
import { normalizePlanType, PlanType } from "./payments/subscription-client";

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
  | "super_admin";

export const DEMO_ALLOWED_ROLES: string[] = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
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
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

export interface AuthContextType {
  user: User | null;
  school: School | null;
  loading: boolean;
  authInitialized: boolean;
  isDemo: boolean;
  isTrialExpired: boolean;
  signIn: (
    phone: string,
    password: string,
  ) => Promise<{ error: any; role?: string }>;
  signUp: (
    phone: string,
    password: string,
    name: string,
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSchool: () => Promise<void>;
  isSubscriptionActive: () => boolean;
  getSubscriptionPlan: () => PlanType | null;
}

export function isSubscriptionActiveCheck(
  school: School | null,
): boolean {
  if (school?.subscription_status === "trial" && school?.trial_ends_at) {
    return new Date(school.trial_ends_at) > new Date();
  }
  return school?.subscription_status === "active";
}

export function getSubscriptionPlan(school: School | null): PlanType | null {
  return school?.subscription_plan
    ? (normalizePlanType(school.subscription_plan) as PlanType)
    : null;
}

export function computeTrialExpired(school: School | null): boolean {
  if (!school) return false;
  if (
    school.subscription_status === "trial" &&
    school.trial_ends_at
  ) {
    return new Date(school.trial_ends_at) < new Date();
  }
  return school.subscription_status === "expired";
}
