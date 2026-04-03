'use client'

export function PricingSection() {
  const plans = [
    { name: 'Basic', price: 'UGX 100,000', cadence: 'per term', features: ['300 Students', 'PDF Reports', 'UNEB Export'] },
    { name: 'Premium', price: 'UGX 200,000', cadence: 'per term', featured: true, features: ['1,000 Students', 'Auto SMS', 'Parent Portal'] },
    { name: 'Max', price: 'UGX 370,000', cadence: 'per term', features: ['Unlimited', 'Offline Mode', 'Custom Reports'] },
  ]

  return (
    <section id="pricing" className="py-20 bg-[var(--t1)] text-white">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12">Clear Pricing for Growing Schools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((p, i) => (
            <div key={i} className={`p-8 rounded-[var(--r2)] border ${p.featured ? 'border-[var(--green)] bg-[var(--t2)]' : 'border-[var(--border)]'}`}>
              <h3 className="text-xl font-bold mb-4">{p.name}</h3>
              <div className="text-3xl font-bold mb-6">{p.price}<span className="text-sm font-normal text-[var(--t4)] ml-1">{p.cadence}</span></div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f, fi) => <li key={fi} className="flex items-center gap-2">✓ {f}</li>)}
              </ul>
              <a href="/register" className={`btn w-full ${p.featured ? 'btn-green' : 'btn-ghost'}`}>Start Trial</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
