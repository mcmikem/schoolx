'use client'

export function FeaturesSection() {
  const features = [
    { title: 'Academic Insight', desc: 'Real-time attendance and grade tracking in a single view.' },
    { title: 'Financial Control', desc: 'Fee collection, payment tracking, and automated reminders.' },
    { title: 'Unified Comms', desc: 'SMS announcements and parent portal integration.' },
  ]

  return (
    <section className="py-20 bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <div key={i} className="card p-8">
            <h3 className="text-xl font-bold text-[var(--t1)] mb-4">{f.title}</h3>
            <p className="text-[var(--t2)] leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
