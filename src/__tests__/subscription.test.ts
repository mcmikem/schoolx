import { PLANS, PLAN_PRICES, canUseFeature, getFeatureLimit, formatPrice, getUpgradeMessage } from '../lib/subscription'
import { PlanType } from '../lib/payments/subscription-client'

describe('Subscription - Plan Features', () => {
  describe('PLANS', () => {
    test('free_trial has limited features', () => {
      expect(PLANS.free_trial.maxStudents).toBe(100)
      expect(PLANS.free_trial.offlineMode).toBe(false)
      expect(PLANS.free_trial.parentPortal).toBe(false)
    })

    test('basic has moderate features', () => {
      expect(PLANS.basic.maxStudents).toBe(300)
      expect(PLANS.basic.unebExport).toBe(true)
      expect(PLANS.basic.pdfReports).toBe(true)
    })

    test('premium has most features', () => {
      expect(PLANS.premium.maxStudents).toBe(1000)
      expect(PLANS.premium.parentPortal).toBe(true)
      expect(PLANS.premium.autoSMSReports).toBe(true)
    })

    test('max has unlimited features', () => {
      expect(PLANS.max.maxStudents).toBe(Infinity)
      expect(PLANS.max.multiSchool).toBe(true)
      expect(PLANS.max.prioritySupport).toBe(true)
    })
  })

  describe('PLAN_PRICES', () => {
    test('free_trial is free', () => {
      expect(PLAN_PRICES.free_trial.term).toBe(0)
    })

    test('basic is affordable', () => {
      expect(PLAN_PRICES.basic.term).toBe(100000)
    })

    test('premium is mid-tier', () => {
      expect(PLAN_PRICES.premium.term).toBe(200000)
    })

    test('max is most expensive', () => {
      expect(PLAN_PRICES.max.term).toBe(370000)
    })
  })
})

describe('Subscription - Feature Access', () => {
  describe('canUseFeature', () => {
    test('free_trial cannot use offline mode', () => {
      expect(canUseFeature('free_trial', 'offlineMode')).toBe(false)
    })

    test('max can use offline mode', () => {
      expect(canUseFeature('max', 'offlineMode')).toBe(true)
    })

    test('premium can use parent portal', () => {
      expect(canUseFeature('premium', 'parentPortal')).toBe(true)
    })

    test('basic cannot use parent portal', () => {
      expect(canUseFeature('basic', 'parentPortal')).toBe(false)
    })

    test('max can use all features', () => {
      const features: (keyof typeof PLANS.max)[] = ['offlineMode', 'parentPortal', 'multiSchool', 'apiAccess']
      features.forEach(feature => {
        expect(canUseFeature('max', feature)).toBe(true)
      })
    })
  })

  describe('getFeatureLimit', () => {
    test('returns student limit for free_trial', () => {
      expect(getFeatureLimit('free_trial', 'maxStudents')).toBe(100)
    })

    test('returns infinity for max plan', () => {
      expect(getFeatureLimit('max', 'maxStudents')).toBe(Infinity)
    })

    test('returns 0 for boolean features', () => {
      expect(getFeatureLimit('basic', 'offlineMode')).toBe(0)
    })

    test('returns SMS limit', () => {
      expect(getFeatureLimit('free_trial', 'maxSMSPerMonth')).toBe(20)
      expect(getFeatureLimit('max', 'maxSMSPerMonth')).toBe(2000)
    })
  })
})

describe('Subscription - Formatting', () => {
  test('formatPrice returns Free for 0', () => {
    expect(formatPrice(0)).toBe('Free')
  })

  test('formatPrice formats UGX correctly', () => {
    expect(formatPrice(100000)).toBe('UGX 100,000')
    expect(formatPrice(50000)).toBe('UGX 50,000')
  })

  test('getUpgradeMessage returns correct message', () => {
    expect(getUpgradeMessage('parent portal')).toBe('This feature requires a higher plan. Upgrade to unlock parent portal.')
  })
})
