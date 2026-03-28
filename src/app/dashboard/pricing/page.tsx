'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { PLANS, PLAN_PRICES, formatPrice, PlanType, PlanFeatures } from '@/lib/subscription'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

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

export default function PricingPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)

  const currentPlan = (school?.subscription_plan as PlanType) || 'free_trial'

  const handleUpgrade = (plan: PlanType) => {
    setSelectedPlan(plan)
    toast.info('Contact us to upgrade: 0750028703 or sms@omuto.org')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#002045]">Pricing</h1>
        <p className="text-[#5c6670] mt-2 max-w-xl mx-auto">
          Choose the plan that fits your school. All plans include a free trial term.
        </p>
      </div>

      {/* Pricing Cards */}
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
              ) : (
                <button 
                  onClick={() => handleUpgrade(planKey)}
                  className={`btn w-full ${isPopular ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {planKey === 'free_trial' ? 'Start Free Trial' : 'Upgrade'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature Comparison Table */}
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

      {/* Contact Section */}
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
