// Subscription client - matches landing page pricing
// Starter: UGX 2,000/student/term
// Growth: UGX 3,500/student/term
// Enterprise: UGX 5,500/student/term
// Lifetime: UGX 8-15M one-time

export type PlanType =
  | "starter"
  | "growth"
  | "enterprise"
  | "lifetime"
  | "free_trial";

export interface PlanFeatures {
  name: string;
  pricePerStudent: number;
  priceFrequency: "term" | "annual" | "one_time";
  maxStudents: number;
  adminUsers: number;
  smsQuota: number;
  offlineMode: boolean;
  parentPortal: boolean;
  syllabus: boolean;
  lessonPlans: boolean;
  dormManagement: boolean;
  transport: boolean;
  library: boolean;
  budgets: boolean;
  unebRegistration: boolean;
  moesExports: boolean;
  payroll: boolean;
  staffLeave: boolean;
  aiInsights: boolean;
  workflowAutomation: boolean;
  auditLogs: boolean;
  apiAccess: boolean;
  multiBranch: boolean;
}

export const PLANS: Record<PlanType, PlanFeatures> = {
  free_trial: {
    name: "Free Trial",
    pricePerStudent: 0,
    priceFrequency: "term",
    maxStudents: 100,
    adminUsers: 3,
    smsQuota: 0,
    offlineMode: false,
    parentPortal: false,
    syllabus: false,
    lessonPlans: false,
    dormManagement: false,
    transport: false,
    library: false,
    budgets: false,
    unebRegistration: false,
    moesExports: false,
    payroll: false,
    staffLeave: false,
    aiInsights: false,
    workflowAutomation: false,
    auditLogs: false,
    apiAccess: false,
    multiBranch: false,
  },
  starter: {
    name: "Starter",
    pricePerStudent: 2000,
    priceFrequency: "term",
    maxStudents: 500,
    adminUsers: 3,
    smsQuota: 0,
    offlineMode: true,
    parentPortal: false,
    syllabus: false,
    lessonPlans: false,
    dormManagement: false,
    transport: false,
    library: false,
    budgets: false,
    unebRegistration: false,
    moesExports: false,
    payroll: false,
    staffLeave: false,
    aiInsights: false,
    workflowAutomation: false,
    auditLogs: false,
    apiAccess: false,
    multiBranch: false,
  },
  growth: {
    name: "Growth",
    pricePerStudent: 3500,
    priceFrequency: "term",
    maxStudents: 2000,
    adminUsers: 10,
    smsQuota: 500,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
    unebRegistration: false,
    moesExports: false,
    payroll: false,
    staffLeave: false,
    aiInsights: false,
    workflowAutomation: false,
    auditLogs: false,
    apiAccess: false,
    multiBranch: false,
  },
  enterprise: {
    name: "Enterprise",
    pricePerStudent: 5500,
    priceFrequency: "term",
    maxStudents: Infinity,
    adminUsers: Infinity,
    smsQuota: Infinity,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
    unebRegistration: true,
    moesExports: true,
    payroll: true,
    staffLeave: true,
    aiInsights: true,
    workflowAutomation: true,
    auditLogs: true,
    apiAccess: true,
    multiBranch: true,
  },
  lifetime: {
    name: "Lifetime",
    pricePerStudent: 0,
    priceFrequency: "one_time",
    maxStudents: Infinity,
    adminUsers: Infinity,
    smsQuota: Infinity,
    offlineMode: true,
    parentPortal: true,
    syllabus: true,
    lessonPlans: true,
    dormManagement: true,
    transport: true,
    library: true,
    budgets: true,
    unebRegistration: true,
    moesExports: true,
    payroll: true,
    staffLeave: true,
    aiInsights: true,
    workflowAutomation: true,
    auditLogs: true,
    apiAccess: true,
    multiBranch: true,
  },
};

// Plan order for upgrades
export const order: PlanType[] = [
  "free_trial",
  "starter",
  "growth",
  "enterprise",
  "lifetime",
];

// Get next plan in order
export function getNextPlan(currentPlan: PlanType): PlanType | null {
  const currentIndex = order.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex === order.length - 1) return null;
  return order[currentIndex + 1];
}

// Calculate price for student count
export function calculatePrice(plan: PlanType, studentCount: number): number {
  return PLANS[plan].pricePerStudent * studentCount;
}

// Check if feature is available
export function hasFeature(
  plan: PlanType,
  feature: keyof PlanFeatures,
): boolean {
  const value = PLANS[plan][feature];
  return value === true || value === Infinity;
}

// Get feature limit value
export function getFeatureLimit(
  plan: PlanType,
  feature: keyof PlanFeatures,
): number {
  const value = PLANS[plan][feature];
  if (value === Infinity) return -1;
  return typeof value === "number" ? value : 0;
}

// Get plan usage warning message
export function getPlanUsageWarning(
  plan: PlanType,
  currentCount: number,
  feature: keyof PlanFeatures,
): string | null {
  const limit = getFeatureLimit(plan, feature);
  if (limit === -1) return null; // Unlimited
  if (currentCount >= limit) {
    return `You've reached the ${feature} limit (${limit}) for your ${plan} plan. Upgrade to unlock more.`;
  }
  return null;
}
