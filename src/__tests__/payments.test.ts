import { 
  PAYMENT_PROVIDERS, 
  getPlanFromAmount, 
  getPlanPrice, 
  validatePaymentAmount 
} from '../lib/payments/utils'
import { PLAN_PRICES } from '../lib/subscription'

describe('Payment Utils', () => {
  describe('PAYMENT_PROVIDERS', () => {
    test('has all required providers', () => {
      expect(PAYMENT_PROVIDERS.STRIPE).toBe('stripe')
      expect(PAYMENT_PROVIDERS.PAYPAL).toBe('paypal')
      expect(PAYMENT_PROVIDERS.MTN).toBe('mtn')
      expect(PAYMENT_PROVIDERS.AIRTEL).toBe('airtel')
    })
  })

  describe('getPlanFromAmount', () => {
    test('returns basic for basic price', () => {
      expect(getPlanFromAmount(PLAN_PRICES.basic.term)).toBe('basic')
    })

    test('returns premium for premium price', () => {
      expect(getPlanFromAmount(PLAN_PRICES.premium.term)).toBe('premium')
    })

    test('returns max for max price', () => {
      expect(getPlanFromAmount(PLAN_PRICES.max.term)).toBe('max')
    })

    test('returns free_trial for unknown amount', () => {
      expect(getPlanFromAmount(999999)).toBe('free_trial')
    })

    test('returns free_trial for zero', () => {
      expect(getPlanFromAmount(0)).toBe('free_trial')
    })
  })

  describe('getPlanPrice', () => {
    test('returns correct price for basic', () => {
      expect(getPlanPrice('basic')).toBe(PLAN_PRICES.basic.term)
    })

    test('returns correct price for premium', () => {
      expect(getPlanPrice('premium')).toBe(PLAN_PRICES.premium.term)
    })

    test('returns correct price for max', () => {
      expect(getPlanPrice('max')).toBe(PLAN_PRICES.max.term)
    })

    test('returns 0 for free_trial', () => {
      expect(getPlanPrice('free_trial')).toBe(0)
    })

    test('returns 0 for invalid plan', () => {
      expect(getPlanPrice('invalid' as any)).toBe(0)
    })
  })

  describe('validatePaymentAmount', () => {
    test('validates exact amount', () => {
      expect(validatePaymentAmount(PLAN_PRICES.basic.term, 'basic')).toBe(true)
      expect(validatePaymentAmount(PLAN_PRICES.premium.term, 'premium')).toBe(true)
      expect(validatePaymentAmount(PLAN_PRICES.max.term, 'max')).toBe(true)
    })

    test('validates overpayment', () => {
      expect(validatePaymentAmount(PLAN_PRICES.basic.term + 10000, 'basic')).toBe(true)
    })

    test('rejects underpayment', () => {
      expect(validatePaymentAmount(PLAN_PRICES.basic.term - 10000, 'basic')).toBe(false)
    })
  })
})

describe('Payment Price Consistency', () => {
  test('plan prices are positive', () => {
    expect(PLAN_PRICES.basic.term).toBeGreaterThan(0)
    expect(PLAN_PRICES.premium.term).toBeGreaterThan(0)
    expect(PLAN_PRICES.max.term).toBeGreaterThan(0)
  })

  test('premium is more than basic', () => {
    expect(PLAN_PRICES.premium.term).toBeGreaterThan(PLAN_PRICES.basic.term)
  })

  test('max is more than premium', () => {
    expect(PLAN_PRICES.max.term).toBeGreaterThan(PLAN_PRICES.premium.term)
  })
})
