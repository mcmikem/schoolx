import { PLAN_PRICES, PlanType } from '../subscription'
import { createSupabaseServerClient } from '../supabase/server'

export const PAYMENT_PROVIDERS = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  MTN: 'mtn',
  AIRTEL: 'airtel',
} as const

export type PaymentProviderType = typeof PAYMENT_PROVIDERS[keyof typeof PAYMENT_PROVIDERS]

export const PAYMENT_PRICES_UGX = {
  basic: PLAN_PRICES.basic.term,
  premium: PLAN_PRICES.premium.term,
  max: PLAN_PRICES.max.term,
}

export const STRIPE_PRICE_IDS: Record<PlanType, string | undefined> = {
  free_trial: undefined,
  basic: process.env.STRIPE_PRICE_BASIC,
  premium: process.env.STRIPE_PRICE_PREMIUM,
  max: process.env.STRIPE_PRICE_MAX,
}

export function getPlanFromAmount(amount: number): PlanType {
  if (amount === PAYMENT_PRICES_UGX.basic) return 'basic'
  if (amount === PAYMENT_PRICES_UGX.premium) return 'premium'
  if (amount === PAYMENT_PRICES_UGX.max) return 'max'
  return 'free_trial'
}

export function getPlanPrice(plan: PlanType): number {
  return PAYMENT_PRICES_UGX[plan as keyof typeof PAYMENT_PRICES_UGX] || 0
}

export function validatePaymentAmount(amount: number, plan: PlanType): boolean {
  const expectedAmount = getPlanPrice(plan)
  return amount >= expectedAmount
}

export async function recordPayment(params: {
  schoolId: string
  plan: PlanType
  amount: number
  provider: PaymentProviderType
  transactionId: string
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
  customerId?: string
  subscriptionId?: string
  invoiceUrl?: string
  receiptUrl?: string
  paymentMethodDetail?: string
  phoneNumber?: string
  paidAt?: string
}) {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('subscription_payments')
    .insert({
      school_id: params.schoolId,
      plan: params.plan,
      amount: params.amount,
      currency: 'UGX',
      provider: params.provider,
      transaction_id: params.transactionId,
      payment_status: params.paymentStatus,
      customer_id: params.customerId,
      subscription_id: params.subscriptionId,
      invoice_url: params.invoiceUrl,
      receipt_url: params.receiptUrl,
      payment_method_detail: params.paymentMethodDetail,
      phone_number: params.phoneNumber,
      paid_at: params.paidAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Error recording payment:', error)
    throw error
  }

  return data
}

export async function updatePaymentStatus(
  transactionId: string,
  status: 'pending' | 'completed' | 'failed' | 'refunded',
  additionalFields?: {
    invoice_url?: string
    receipt_url?: string
    subscription_id?: string
    paid_at?: string
  }
) {
  const supabase = createSupabaseServerClient()

  const updateData: Record<string, unknown> = {
    payment_status: status,
  }

  if (additionalFields) {
    Object.assign(updateData, additionalFields)
  }

  const { data, error } = await supabase
    .from('subscription_payments')
    .update(updateData)
    .eq('transaction_id', transactionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating payment status:', error)
    throw error
  }

  return data
}

export async function logPaymentHistory(params: {
  schoolId: string
  paymentId?: string
  action: string
  description?: string
  metadata?: Record<string, unknown>
}) {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('payment_history')
    .insert({
      school_id: params.schoolId,
      payment_id: params.paymentId,
      action: params.action,
      description: params.description,
      metadata: params.metadata,
    })
    .select()
    .single()

  if (error) {
    console.error('Error logging payment history:', error)
    throw error
  }

  return data
}

export async function activateSchoolSubscription(
  schoolId: string,
  plan: PlanType,
  provider: PaymentProviderType,
  subscriptionId?: string
) {
  const supabase = createSupabaseServerClient()

  const trialDays = parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '30')
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + trialDays)

  const updateData: Record<string, unknown> = {
    subscription_plan: plan,
    subscription_status: 'active',
    last_payment_at: new Date().toISOString(),
    next_payment_date: trialEndDate.toISOString(),
  }

  if (provider === 'stripe') {
    updateData.stripe_subscription_id = subscriptionId
  } else if (provider === 'paypal') {
    updateData.paypal_subscription_id = subscriptionId
  }

  const { data, error } = await supabase
    .from('schools')
    .update(updateData)
    .eq('id', schoolId)
    .select()
    .single()

  if (error) {
    console.error('Error activating subscription:', error)
    throw error
  }

  return data
}

export async function getSchoolPaymentHistory(schoolId: string, limit = 10) {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching payment history:', error)
    throw error
  }

  return data
}

export async function savePendingMobilePayment(params: {
  schoolId: string
  plan: PlanType
  amount: number
  provider: 'mtn' | 'airtel'
  phoneNumber: string
  txRef: string
}) {
  const supabase = createSupabaseServerClient()

  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 30)

  const { data, error } = await supabase
    .from('pending_mobile_payments')
    .upsert({
      school_id: params.schoolId,
      plan: params.plan,
      amount: params.amount,
      provider: params.provider,
      phone_number: params.phoneNumber,
      tx_ref: params.txRef,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'tx_ref' })
    .select()
    .single()

  if (error) {
    console.error('Error saving pending mobile payment:', error)
    throw error
  }

  return data
}

export async function getPendingMobilePayment(txRef: string) {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('pending_mobile_payments')
    .select('*')
    .eq('tx_ref', txRef)
    .single()

  if (error) {
    console.error('Error fetching pending mobile payment:', error)
    throw error
  }

  return data
}

export async function updatePendingMobilePayment(
  txRef: string,
  status: 'pending' | 'completed' | 'failed' | 'expired'
) {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('pending_mobile_payments')
    .update({ status })
    .eq('tx_ref', txRef)
    .select()
    .single()

  if (error) {
    console.error('Error updating pending mobile payment:', error)
    throw error
  }

  return data
}

export default {
  PAYMENT_PROVIDERS,
  PAYMENT_PRICES_UGX,
  STRIPE_PRICE_IDS,
  getPlanFromAmount,
  getPlanPrice,
  validatePaymentAmount,
  recordPayment,
  updatePaymentStatus,
  logPaymentHistory,
  activateSchoolSubscription,
  getSchoolPaymentHistory,
  savePendingMobilePayment,
  getPendingMobilePayment,
  updatePendingMobilePayment,
}
