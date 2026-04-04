export type PlanType = 'free_trial' | 'basic' | 'premium' | 'max'

export interface PlanFeatures {
  name: string
  maxStudents: number
  maxSMSPerMonth: number
  offlineMode: boolean
  autoSMSReports: boolean
  unebExport: boolean
  pdfReports: boolean
  whatsappIntegration: boolean
  capitationTracking: boolean
  dataExport: boolean
  globalSearch: boolean
  multiLanguage: boolean
  parentPortal: boolean
  customReports: boolean
  prioritySupport: boolean
  apiAccess: boolean
  multiSchool: boolean
}

export const PLANS: Record<PlanType, PlanFeatures> = {
  free_trial: {
    name: 'Free Trial',
    maxStudents: 100,
    maxSMSPerMonth: 20,
    offlineMode: false,
    autoSMSReports: false,
    unebExport: false,
    pdfReports: false,
    whatsappIntegration: false,
    capitationTracking: false,
    dataExport: false,
    globalSearch: false,
    multiLanguage: false,
    parentPortal: false,
    customReports: false,
    prioritySupport: false,
    apiAccess: false,
    multiSchool: false,
  },
  basic: {
    name: 'Basic',
    maxStudents: 300,
    maxSMSPerMonth: 100,
    offlineMode: false,
    autoSMSReports: false,
    unebExport: true,
    pdfReports: true,
    whatsappIntegration: false,
    capitationTracking: false,
    dataExport: true,
    globalSearch: false,
    multiLanguage: false,
    parentPortal: false,
    customReports: false,
    prioritySupport: false,
    apiAccess: false,
    multiSchool: false,
  },
  premium: {
    name: 'Premium',
    maxStudents: 1000,
    maxSMSPerMonth: 500,
    offlineMode: false,
    autoSMSReports: true,
    unebExport: true,
    pdfReports: true,
    whatsappIntegration: true,
    capitationTracking: true,
    dataExport: true,
    globalSearch: true,
    multiLanguage: true,
    parentPortal: true,
    customReports: false,
    prioritySupport: false,
    apiAccess: false,
    multiSchool: false,
  },
  max: {
    name: 'Max',
    maxStudents: Infinity,
    maxSMSPerMonth: 2000,
    offlineMode: true,
    autoSMSReports: true,
    unebExport: true,
    pdfReports: true,
    whatsappIntegration: true,
    capitationTracking: true,
    dataExport: true,
    globalSearch: true,
    multiLanguage: true,
    parentPortal: true,
    customReports: true,
    prioritySupport: true,
    apiAccess: true,
    multiSchool: true,
  },
}

export const PLAN_PRICES = {
  free_trial: { term: 0 },
  basic: { term: 100000 },
  premium: { term: 200000 },
  max: { term: 370000 },
}

export type PaymentProvider = 'paypal' | 'mtn' | 'airtel'

export interface PaymentRequest {
  plan: PlanType
  provider: PaymentProvider
  returnUrl?: string
}

export interface PaymentResponse {
  success: boolean
  redirectUrl?: string
  error?: string
}

export function formatPrice(amount: number): string {
  if (amount === 0) return 'Free'
  return `UGX ${amount.toLocaleString()}`
}

export function getUpgradeMessage(feature: string): string {
  return `This feature requires a higher plan. Upgrade to unlock ${feature}.`
}

export function canUseFeature(plan: PlanType, feature: keyof PlanFeatures): boolean {
  return !!PLANS[plan][feature]
}

export function getFeatureLimit(plan: PlanType, feature: 'maxStudents' | 'maxSMSPerMonth'): number {
  return PLANS[plan][feature]
}

export function isPlanUpgrade(current: PlanType, target: PlanType): boolean {
  const order: PlanType[] = ['free_trial', 'basic', 'premium', 'max']
  return order.indexOf(target) > order.indexOf(current)
}

export function getPlanUsageWarning(plan: PlanType, currentCount: number, limitKey: 'maxStudents' | 'maxSMSPerMonth'): string | null {
  const limit = getFeatureLimit(plan, limitKey)
  if (currentCount >= limit) {
    return `You've reached your plan limit of ${limit === Infinity ? '∞' : limit.toLocaleString()} ${limitKey === 'maxStudents' ? 'students' : 'SMS messages'}. Upgrade to add more.`
  }
  if (currentCount >= limit * 0.8) {
    return `You're at ${Math.round((currentCount / limit) * 100)}% of your ${limitKey === 'maxStudents' ? 'student' : 'SMS'} limit (${currentCount}/${limit === Infinity ? '∞' : limit.toLocaleString()}). Consider upgrading.`
  }
  return null
}
