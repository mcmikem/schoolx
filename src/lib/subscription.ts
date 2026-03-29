// Subscription plans and premium feature guards

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

export function canUseFeature(plan: PlanType, feature: keyof PlanFeatures): boolean {
  const value = PLANS[plan][feature]
  return value === true || value === Infinity
}

export function getFeatureLimit(plan: PlanType, feature: keyof PlanFeatures): number {
  const value = PLANS[plan][feature]
  return typeof value === 'number' ? value : 0
}

export function formatPrice(amount: number): string {
  if (amount === 0) return 'Free'
  return `UGX ${amount.toLocaleString()}`
}

export function getUpgradeMessage(feature: string): string {
  return `This feature requires a higher plan. Upgrade to unlock ${feature}.`
}

// Payment-related functions would be added here when integrating with Stripe/PayPal
// These would be implemented in the payments directory and imported as needed

// We'll add types for payment processing
export type PaymentProvider = 'stripe' | 'paypal' | 'mtn' | 'airtel'

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

// Database functions for subscription management
import { createSupabaseServerClient } from './supabase/server'

/**
 * Update a school's subscription status in the database
 */
export async function updateSchoolSubscription(
  schoolId: string,
  updates: {
    subscription_status?: 'active' | 'expired' | 'trial' | 'past_due'
    subscription_plan?: PlanType
    stripe_customer_id?: string
    stripe_subscription_id?: string
    paypal_subscription_id?: string
    last_payment_at?: string
    next_payment_date?: string
    last_payment_attempt?: string
    trial_ends_at?: string | null
  }
) {
  try {
    const supabase = createSupabaseServerClient()
    
    const { data, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
    
    if (error) {
      console.error('Error updating school subscription:', error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Error in updateSchoolSubscription:', error)
    throw error
  }
}

/**
 * Send payment receipt via email and/or SMS
 */
export async function sendPaymentReceipt(
  schoolId: string,
  paymentData: {
    amount: number
    currency: string
    date: string
    plan: PlanType
    provider: PaymentProvider
    transactionId: string
  }
) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get school information
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, email, phone, school_code')
      .eq('id', schoolId)
      .single()
      
    if (schoolError) {
      console.error('Error fetching school for receipt:', schoolError)
      throw schoolError
    }
    
    // Format amount for display
    const formattedAmount = new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX'
    }).format(paymentData.amount)
    
    // Create email content
    const emailSubject = `Payment Receipt - ${school.name}`
    const emailBody = `
      <h2>Payment Receipt</h2>
      <p>Thank you for your payment!</p>
      <p><strong>School:</strong> ${school.name} (${school.school_code})</p>
      <p><strong>Date:</strong> ${new Date(paymentData.date).toLocaleDateString()}</p>
      <p><strong>Amount:</strong> ${formattedAmount}</p>
      <p><strong>Plan:</strong> ${paymentData.plan.charAt(0).toUpperCase() + paymentData.plan.slice(1)}</p>
      <p><strong>Payment Method:</strong> ${paymentData.provider.charAt(0).toUpperCase() + paymentData.provider.slice(1)}</p>
      <p><strong>Transaction ID:</strong> ${paymentData.transactionId}</p>
      <p>Your subscription is now active. Thank you for using Omuto School Management System!</p>
    `
    
    // Send email (using a placeholder - in reality, you'd use an email service)
    console.log(`Sending email receipt to ${school.email}:`, emailSubject)
    
    // Send SMS notification
    if (school.phone) {
      const smsMessage = `Payment confirmed for ${school.name}. Amount: ${formattedAmount}. Plan: ${paymentData.plan}. Thank you!`
      // In a real implementation, you would call your SMS service here
      console.log(`Sending SMS to ${school.phone}:`, smsMessage)
    }
    
    // Record the receipt in database (optional)
    // await supabase.from('payment_receipts').insert({ ... })
    
    return { success: true }
  } catch (error) {
    console.error('Error sending payment receipt:', error)
    throw error
  }
}

/**
 * Handle subscription changes from webhooks
 */
export async function handleSubscriptionChange(
  schoolId: string,
  changeData: {
    status: 'active' | 'past_due' | 'canceled' | 'unpaid'
    plan?: PlanType
    provider: 'stripe' | 'paypal'
    subscriptionId?: string
  }
) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Determine subscription status based on change data
    let subscriptionStatus: 'active' | 'expired' | 'trial' | 'past_due'
    switch (changeData.status) {
      case 'active':
        subscriptionStatus = 'active'
        break
      case 'past_due':
      case 'unpaid':
        subscriptionStatus = 'past_due'
        break
      case 'canceled':
        subscriptionStatus = 'expired'
        break
      default:
        subscriptionStatus = 'trial'
    }
    
    // Prepare updates
    const updates: any = {
      subscription_status: subscriptionStatus
    }
    
    if (changeData.plan) {
      updates.subscription_plan = changeData.plan
    }
    
    if (changeData.provider === 'stripe' && changeData.subscriptionId) {
      updates.stripe_subscription_id = changeData.subscriptionId
    }
    
    if (changeData.provider === 'paypal' && changeData.subscriptionId) {
      updates.paypal_subscription_id = changeData.subscriptionId
    }
    
    // If subscription is canceled/expired, clear subscription IDs
    if (changeData.status === 'canceled') {
      if (changeData.provider === 'stripe') {
        updates.stripe_subscription_id = null
      }
      if (changeData.provider === 'paypal') {
        updates.paypal_subscription_id = null
      }
    }
    
    // Update school subscription
    await updateSchoolSubscription(schoolId, updates)
    
    // Send notification about subscription change
    const notificationMessage = `Your subscription status has been updated to ${subscriptionStatus}.`
    console.log(`Sending subscription change notification for school ${schoolId}:`, notificationMessage)
    
    return { success: true }
  } catch (error) {
    console.error('Error handling subscription change:', error)
    throw error
  }
}

/**
 * Utility function to determine plan from Stripe amount
 */
export function determineStripePlanFromAmount(amountInCents: number): PlanType {
  const amountInDollars = amountInCents / 100
  
  if (amountInDollars === 0) return 'free_trial'
  if (amountInDollars <= 10) return 'basic'
  if (amountInDollars <= 20) return 'premium'
  return 'max'
}

/**
 * Utility function to determine plan from Stripe subscription
 */
export function determineStripePlanFromSubscription(subscription: any): PlanType {
  // Get the price ID from subscription items
  const priceId = subscription.items.data[0]?.price.id
  
  // Map price IDs to plans (you would configure these in your Stripe dashboard)
  const priceToPlan: Record<string, PlanType> = {
    // Add your actual price IDs here
    'price_basic': 'basic',
    'price_premium': 'premium',
    'price_max': 'max',
  }
  
  return priceToPlan[priceId] || 'free_trial'
}

/**
 * Utility function to determine plan from PayPal amount
 */
export function determinePayPalPlanFromAmount(amount: number): PlanType {
  if (amount === 0) return 'free_trial'
  if (amount <= 10) return 'basic'
  if (amount <= 20) return 'premium'
  return 'max'
}

/**
 * Utility function to determine plan from PayPal plan ID
 */
export function determinePayPalPlanFromId(planId: string): PlanType {
  // Map PayPal plan IDs to plans (you would configure these in your PayPal dashboard)
  const planIdToPlan: Record<string, PlanType> = {
    // Add your actual PayPal plan IDs here
    'plan_basic': 'basic',
    'plan_premium': 'premium',
    'plan_max': 'max',
  }
  
  return planIdToPlan[planId] || 'free_trial'
}

export default {
  updateSchoolSubscription,
  sendPaymentReceipt,
  handleSubscriptionChange,
  determineStripePlanFromAmount,
  determineStripePlanFromSubscription,
  determinePayPalPlanFromAmount,
  determinePayPalPlanFromId
}
