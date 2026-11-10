// ============================================================================
// 🚩 Feature Flags System
// ============================================================================
// Controls rollout of new features. All flags default to DISABLED.
// Enable gradually: 0% → 10% → 50% → 100%
// Use EMERGENCY_KILL_SWITCH to disable ALL new features instantly
// ============================================================================
import { logger } from "@/lib/logger";

export type FeatureFlag =
  | "new_fee_workflow"
  | "advanced_reporting"
  | "offline_mode_v2"
  | "teacher_dashboard_v2"
  | "student_portal_v2"
  | "mobile_app_v2";

export interface FeatureFlagConfig {
  enabled: boolean;
  rollout_pct: number; // 0-100, percentage of users who see this feature
  description: string;
  rollout_date?: string; // ISO date when fully rolled out
  owner?: string; // Team member responsible
}

/**
 * Feature flag configuration.
 * Add new flags here when developing new features.
 * All new features should be disabled by default (enabled: false).
 */
export const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  new_fee_workflow: {
    enabled: false,
    rollout_pct: 0,
    description: "New fee payment workflow with improved UX",
    owner: "product-team",
  },
  advanced_reporting: {
    enabled: false,
    rollout_pct: 0,
    description: "Advanced report builder with custom charts",
    owner: "product-team",
  },
  offline_mode_v2: {
    enabled: false,
    rollout_pct: 0,
    description: "Enhanced offline sync with conflict resolution",
    owner: "mobile-team",
  },
  teacher_dashboard_v2: {
    enabled: false,
    rollout_pct: 0,
    description: "New teacher dashboard with improved navigation",
    owner: "ux-team",
  },
  student_portal_v2: {
    enabled: false,
    rollout_pct: 0,
    description: "New student portal with improved grade viewing",
    owner: "product-team",
  },
  mobile_app_v2: {
    enabled: false,
    rollout_pct: 0,
    description: "Updated mobile app with offline-first architecture",
    owner: "mobile-team",
  },
};

/**
 * Emergency kill switch - set to true to disable ALL new features instantly.
 * Use this when a critical bug is discovered in production.
 */
export const EMERGENCY_KILL_SWITCH = {
  all_new_features: false,
  specific_features: {
    new_fee_workflow: false,
    advanced_reporting: false,
    offline_mode_v2: false,
    teacher_dashboard_v2: false,
    student_portal_v2: false,
    mobile_app_v2: false,
  },
};

/**
 * Simple hash function for consistent user-based rollout.
 * Same user ID always gets same hash value.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Check if a feature flag is enabled for a specific user.
 * Uses gradual rollout based on user ID hash.
 *
 * @param flag - The feature flag name
 * @param userId - Optional user ID for gradual rollout
 * @returns boolean - Whether the feature is enabled for this user
 */
export function isFeatureEnabled(flag: FeatureFlag, userId?: string): boolean {
  // Emergency kill switch takes precedence
  if (EMERGENCY_KILL_SWITCH.all_new_features) {
    return false;
  }

  const config = FEATURE_FLAGS[flag];
  if (!config) {
    logger.warn(`[FeatureFlags] Unknown flag: ${flag}`);
    return false;
  }

  // If specific feature is killed in emergency switch
  if (EMERGENCY_KILL_SWITCH.specific_features[flag]) {
    return false;
  }

  // Feature not enabled at all
  if (!config.enabled) {
    return false;
  }

  // Full rollout - everyone gets it
  if (config.rollout_pct >= 100) {
    return true;
  }

  // No rollout - no one gets it
  if (config.rollout_pct <= 0) {
    return false;
  }

  // Gradual rollout based on user ID
  if (userId) {
    const hash = simpleHash(userId) % 100;
    return hash < config.rollout_pct;
  }

  // No user ID, can't do gradual rollout
  return false;
}

/**
 * Get all feature flags with their current status.
 * Useful for admin dashboards and debugging.
 */
export function getAllFeatureFlags(): Record<string, FeatureFlagConfig & { enabled_for_user: boolean }> {
  const result: Record<string, FeatureFlagConfig & { enabled_for_user: boolean }> = {};
  for (const [key, config] of Object.entries(FEATURE_FLAGS)) {
    result[key] = { ...config, enabled_for_user: config.enabled && !EMERGENCY_KILL_SWITCH.all_new_features };
  }
  return result;
}

/**
 * Check if any new features are enabled (useful for UI decisions).
 */
export function hasAnyNewFeaturesEnabled(): boolean {
  return Object.values(FEATURE_FLAGS).some((config) => config.enabled && !EMERGENCY_KILL_SWITCH.all_new_features);
}
