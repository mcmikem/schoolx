// Backward-compat bridge to the unified module catalog
// Re-exports and aliases so all existing consumers keep working.
import {
  FEATURE_STAGE_MODULES as UNIFIED_FEATURE_STAGES,
  DEFAULT_FEATURE_STAGE as UNIFIED_DEFAULT,
  isModuleInFeatureStage as unifiedCanUseModule,
  type FeatureStage,
  type ModuleKey,
} from "./modules/catalog";
import { deepFreeze } from "./deep-freeze";

export type { FeatureStage, ModuleKey };

export const FEATURE_STAGES: Record<FeatureStage, { label: string; description: string; modules: readonly ModuleKey[] }> = deepFreeze({
  core: {
    label: "Core controls",
    description: "Attendance, student records, staff management and basic communication.",
    modules: UNIFIED_FEATURE_STAGES.core as readonly ModuleKey[],
  },
  academic: {
    label: "Academic focus",
    description: "Everything in Core plus marks entry, exams, reports and academic tools.",
    modules: UNIFIED_FEATURE_STAGES.academic as readonly ModuleKey[],
  },
  finance: {
    label: "Finance & operations",
    description: "Everything in Academic plus invoicing, payments, payroll, budgeting and operations modules.",
    modules: UNIFIED_FEATURE_STAGES.finance as readonly ModuleKey[],
  },
  full: {
    label: "Full suite",
    description: "Unlocks parent portal, dorm, health, analytics, and every module the plan supports.",
    modules: UNIFIED_FEATURE_STAGES.full as readonly ModuleKey[],
  },
});

export const DEFAULT_FEATURE_STAGE: FeatureStage = UNIFIED_DEFAULT;

export function canUseModule(stage: FeatureStage | undefined, module: ModuleKey): boolean {
  return unifiedCanUseModule(stage || DEFAULT_FEATURE_STAGE, module);
}
