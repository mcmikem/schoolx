'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { PLANS, PLAN_PRICES, PlanType, PlanFeatures, formatPrice } from '@/lib/payments/subscription-client'
import { useToast } from '@/components/Toast'

import MaterialIcon from '@/components/MaterialIcon'

const plans: PlanType[] = ['free_trial', 'basic', 'premium', 'max']

const features: Array<{key: keyof PlanFeatures, label: string, format?: (v: number) => string}> = [
  { key: 'maxStudents', label: 'Students', format: (v) => v === Infinity ? 'Unlimited' : String(v) },
  { key: 'maxSMSPerMonth', label: 'SMS per month', format: (v) => v === Infinity ? 'Unlimited' : String(v) },
  { key: 'pdfReports', label: 'Report card PDF' },
  { key: 'unebExport', label: 'UNEB data export' },
  { key: 'dataExport', label: 'Export to Excel' },
  { key: 'autoSMSReports', label: 'Auto SMS reports to parents' },
  { key: 'parentPortal', label: 'Parent portal' },
  { key: 'whatsappIntegration', label: 'WhatsApp integration' },
  { key: 'capitationTracking', label: 'Capitation grant tracking' },
  { key: 'multiLanguage', label: 'Luganda support' },
  { key: 'globalSearch', label: 'Global search' },
  { key: 'offlineMode', label: 'Offline mode' },
  { key: 'customReports', label: 'Custom reports' },
  { key: 'prioritySupport', label: 'Priority support' },
]

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  plan: PlanType
  onSuccess: () => void
}

function PaymentModal({ isOpen, onClose, plan, onSuccess }: PaymentModalProps) {
  const { school } = useAuth()
  const toast = useToast()
  const [method, setMethod] = useState<'paypal' | 'mtn' | 'airtel'>('paypal')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'method' | 'phone' | 'processing' | 'success'>('method')

  const price = PLAN_PRICES[plan]

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setStep('success')
      toast.success('Payment successful! Your plan is now active.')
      setTimeout(() => {
        onSuccess()
        window.history.replaceState({}, '', '/dashboard/pricing')
      }, 2000)
    } else if (params.get('canceled') === 'true') {
      toast.error('Payment was canceled.')
      window.history.replaceState({}, '', '/dashboard/pricing')
    }
  }, [onSuccess, toast])

  const handlePayment = async () => {
    if (!school) return

    if ((method === 'mtn' || method === 'airtel') && !phone) {
      setStep('phone')
      return
    }

    setLoading(true)
    setStep('processing')

    try {
      if (method === 'paypal') {
        const response = await fetch('/api/payment/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: method,
            plan,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Payment failed')
        }

        if (data.url) {
          window.location.href = data.url
        } else {
          throw new Error('No payment URL returned')
        }
      } else {
        const response = await fetch('/api/payment/mobile-money', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: method,
            plan,
            phoneNumber: phone,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Payment failed')
        }

        if (data.paymentLink) {
          window.location.href = data.paymentLink
        } else {
          throw new Error('No payment link returned')
        }
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast.error(error instanceof Error ? error.message : 'Payment failed')
      setStep('method')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {step === 'method' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#002045]">Pay for {PLANS[plan].name}</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <p className="text-[#5c6670] mb-6">
              Amount: <span className="font-bold text-[#002045]">{formatPrice(price.term)}</span> per term
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setMethod('paypal')}
                className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                  method === 'paypal' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">PP</span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[#002045]">PayPal</div>
                  <div className="text-sm text-[#5c6670]">Pay with your PayPal account</div>
                </div>
              </button>

              <button
                onClick={() => setMethod('mtn')}
                className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                  method === 'mtn' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-bold">MTN</span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[#002045]">MTN Mobile Money</div>
                  <div className="text-sm text-[#5c6670]">Pay with MTN Momo (Uganda)</div>
                </div>
              </button>

              <button
                onClick={() => setMethod('airtel')}
                className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                  method === 'airtel' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">A</span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[#002045]">Airtel Money</div>
                  <div className="text-sm text-[#5c6670]">Pay with Airtel Money (Uganda)</div>
                </div>
              </button>
            </div>

            <button
              onClick={handlePayment}
              className="btn w-full btn-primary mt-6"
            >
              Continue to Payment
            </button>
          </>
        )}

        {step === 'phone' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#002045]">Enter Phone Number</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <p className="text-[#5c6670] mb-4">
              Enter your {method === 'mtn' ? 'MTN' : 'Airtel'} phone number to receive payment prompt.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#002045] mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="2567XXYYYYYY"
                className="input input-bordered w-full"
              />
              <p className="text-xs text-[#5c6670] mt-1">
                Enter number in format: 2567XXYYYYYY
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('method')}
                className="btn btn-outline flex-1"
              >
                Back
              </button>
              <button
                onClick={handlePayment}
                disabled={!phone}
                className="btn btn-primary flex-1"
              >
                Pay {formatPrice(price.term)}
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="loading loading-spinner loading-lg text-blue-600 mb-4"></div>
            <h3 className="text-xl font-bold text-[#002045] mb-2">Processing Payment</h3>
            <p className="text-[#5c6670]">
              {method === 'paypal' 
                ? 'Redirecting to PayPal...' 
                : 'Please check your phone for payment prompt'}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MaterialIcon icon="check" className="text-green-600 text-4xl" />
            </div>
            <h3 className="text-xl font-bold text-[#002045] mb-2">Payment Successful!</h3>
            <p className="text-[#5c6670]">
              Your {PLANS[plan].name} plan is now active.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  const { school, refreshSchool } = useAuth()
  const toast = useToast()
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const currentPlan = (school?.subscription_plan as PlanType) || 'free_trial'

  const handlePlanSelect = (plan: PlanType) => {
    if (plan === 'free_trial') return
    setSelectedPlan(plan)
    setShowPaymentModal(true)
  }

  const handleSuccess = () => {
    refreshSchool()
    setShowPaymentModal(false)
    setSelectedPlan(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#002045]">Pricing</h1>
        <p className="text-[#5c6670] mt-2 max-w-xl mx-auto">
          Choose the plan that fits your school. All plans include a free trial term.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {plans.map((planKey) => {
          const plan = PLANS[planKey]
          const price = PLAN_PRICES[planKey]
          const isCurrent = currentPlan === planKey
          const isPopular = planKey === 'premium'

          return (
            <div 
              key={planKey}
              className={`bg-white rounded-2xl border border-[#e8eaed] p-6 relative ${isPopular ? 'border-2 border-blue-500' : ''} ${isCurrent ? 'bg-blue-50' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Current Plan
                </div>
              )}

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-[#002045] mb-2">{plan.name}</h2>
                <div className="text-3xl font-bold text-[#002045]">
                  {price.term === 0 ? 'Free' : formatPrice(price.term)}
                </div>
                {price.term > 0 && (
                  <div className="text-sm text-[#5c6670]">per term</div>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <MaterialIcon icon="check" className="text-green-600" />
                  <span className="text-[#002045]">
                    {plan.maxStudents === Infinity ? 'Unlimited' : plan.maxStudents} students
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MaterialIcon icon="check" className="text-green-600" />
                  <span className="text-[#002045]">
                    {plan.maxSMSPerMonth === Infinity ? 'Unlimited' : plan.maxSMSPerMonth} SMS/month
                  </span>
                </div>
                {features.slice(2).map((f) => {
                  const value = plan[f.key]
                  if (!value) return null
                  return (
                    <div key={f.key} className="flex items-center gap-2 text-sm">
                      <MaterialIcon icon="check" className="text-green-600" />
                      <span className="text-[#002045]">{f.label}</span>
                    </div>
                  )
                })}
              </div>

              {isCurrent ? (
                <button disabled className="btn btn-secondary w-full">
                  Current Plan
                </button>
              ) : planKey === 'free_trial' ? (
                <button disabled className="btn btn-outline w-full">
                  Get Started
                </button>
              ) : (
                <button 
                  onClick={() => handlePlanSelect(planKey)}
                  className="btn w-full btn-primary"
                >
                  Subscribe
                </button>
              )}
            </div>
          )
        })}
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setSelectedPlan(null)
        }}
        plan={selectedPlan || 'basic'}
        onSuccess={handleSuccess}
      />

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-[#002045] mb-6">Feature Comparison</h2>
        <table className="table w-full">
          <thead className="bg-[#f8fafb]">
            <tr>
              <th>Feature</th>
              <th className="text-center">Free Trial</th>
              <th className="text-center">Basic</th>
              <th className="text-center">Premium</th>
              <th className="text-center">Max</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.key}>
                <td className="font-medium text-[#002045]">{f.label}</td>
                {plans.map((planKey) => {
                  const value = PLANS[planKey][f.key]
                  const display = f.format ? f.format(value as number) : (value ? 'Yes' : 'No')
                  return (
                    <td key={planKey} className="text-center">
                      {typeof value === 'boolean' ? (
                        value ? (
                          <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )
                      ) : (
                        <span className="text-[#5c6670]">{display}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mt-8 text-center">
        <h2 className="text-lg font-semibold text-[#002045] mb-4">Need Help Choosing?</h2>
        <p className="text-[#5c6670] mb-4">
          Contact us and we will help you find the right plan for your school.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="tel:0750028703" className="btn btn-primary">
            <MaterialIcon icon="phone" />
            Call Us
          </a>
          <a href="https://wa.me/256750028703" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <MaterialIcon icon="chat" />
            WhatsApp
          </a>
          <a href="mailto:sms@omuto.org" className="btn btn-secondary">
            <MaterialIcon icon="email" />
            Email Us
          </a>
        </div>
      </div>
    </div>
  )
}
