"use client";

import { User, School, UserRole } from "@/types";
import { FeatureStage } from "./featureStages";

/**
 * Service to manage Demo Mode state and data.
 * Demo mode allows users to explore the application without an account.
 */

const DEMO_KEY = "skoolmate_demo_v1";
export const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

// Roles allowed in demo mode to prevent accidental privilege escalation
const DEMO_ALLOWED_ROLES: UserRole[] = [
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
];

export const isDemoModeEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true"
  );
};

export const sanitizeDemoRole = (rawRole: string): UserRole => {
  if (DEMO_ALLOWED_ROLES.includes(rawRole as UserRole)) {
    return rawRole as UserRole;
  }
  return "headmaster"; // Default safe role
};

export const getDemoData = (): { user: User; school: School } | null => {
  if (typeof window === "undefined") return null;

  // Cleanup if demo mode was disabled but storage remains
  if (!isDemoModeEnabled()) {
    clearDemoData();
    return null;
  }

  const rawData = sessionStorage.getItem(DEMO_KEY) || localStorage.getItem(DEMO_KEY);
  if (!rawData) return null;

  try {
    // Demo data was stored as base64 in the old version, we'll support both for transition
    const decoded = rawData.startsWith("{") ? rawData : atob(rawData);
    const parsed = JSON.parse(decoded);
    
    const { demoUser, demoSchool } = parsed;

    const user: User = {
      id: "demo-user",
      auth_id: "demo",
      school_id: demoSchool.id || DEMO_SCHOOL_ID,
      full_name: demoUser.name,
      phone: "0700000000",
      role: sanitizeDemoRole(demoUser.role),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const school: School = {
      id: demoSchool.id || DEMO_SCHOOL_ID,
      name: demoSchool.name,
      school_code: demoSchool.school_code || "DEMO001",
      district: demoSchool.district || "Kampala",
      school_type: demoSchool.school_type || "primary",
      ownership: demoSchool.ownership || "private",
      primary_color: demoSchool.primary_color || "#001F3F",
      subscription_plan: demoSchool.subscription_plan || "growth",
      subscription_status: demoSchool.subscription_status || "active",
      feature_stage: (demoSchool.feature_stage as FeatureStage) || "full",
      created_at: new Date().toISOString(),
    };

    return { user, school };
  } catch (error) {
    console.error("[DemoService] Error parsing demo data:", error);
    clearDemoData();
    return null;
  }
};

export const setDemoData = (demoUser: any, demoSchool: any) => {
  if (typeof window === "undefined") return;
  const data = JSON.stringify({ demoUser, demoSchool });
  sessionStorage.setItem(DEMO_KEY, data);
};

export const clearDemoData = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(DEMO_KEY);
};

export const isDemoSession = (): boolean => {
  return !!getDemoData();
};
