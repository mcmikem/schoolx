'use client'
import Link from 'next/link'
import SchoolXLogo from '@/components/SchoolXLogo'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

export default function HomePage() {
  const features = [
    { title: 'Student Records', description: 'Keep all student information in one place. Names, contacts, class details, and more.', icon: 'groups' },
    { title: 'Grade Reports', description: 'Record marks, calculate averages, and print report cards for parents.', icon: 'description' },
    { title: 'Fee Management', description: 'Track school fees, record payments, and see who still owes money.', icon: 'payments' },
    { title: 'Attendance', description: 'Mark daily attendance and see who is present, absent, or late.', icon: 'fact_check' },
    { title: 'SMS to Parents', description: 'Send messages to parents about fees, events, or student progress.', icon: 'sms' },
    { title: 'Timetable', description: 'Create and manage class timetables for each term.', icon: 'calendar_month' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-[#e8eaed]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <SchoolXLogo size="md" />
            <div className="flex items-center gap-3">
              <Link href="/login" className="btn btn-secondary btn-sm">
                Sign In
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e3f2fd] text-[#002045] text-sm font-medium mb-6">
            <MaterialIcon icon="verified" className="text-lg" />
            School Management Made Simple
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#002045] leading-tight">
            Manage your school<br />
            <span className="text-[#006e1c]">the easy way</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[#5c6670] max-w-2xl mx-auto">
            Track students, record grades, manage fees, and send SMS to parents.
            Everything your school needs in one simple system.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn btn-primary text-base px-8 py-4">
              <MaterialIcon icon="rocket_launch" className="text-xl" />
              Start Free Trial
            </Link>
            <Link href="/login" className="btn btn-secondary text-base px-8 py-4">
              <MaterialIcon icon="login" className="text-xl" />
              Sign In to Account
            </Link>
          </div>
          <p className="mt-4 text-sm text-[#5c6670]">
            30 days free. No credit card needed.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#f8fafb]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#002045]">
              Everything your school needs
            </h2>
            <p className="mt-4 text-lg text-[#5c6670]">
              Simple tools that work for primary and secondary schools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#e3f2fd] rounded-xl flex items-center justify-center text-[#002045] mb-4">
                  <MaterialIcon icon={feature.icon} className="text-2xl" />
                </div>
                <h3 className="text-lg font-semibold text-[#002045] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[#5c6670] text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#002045] mb-4">
            Simple pricing
          </h2>
          <p className="text-lg text-[#5c6670] mb-12">
            Start free, upgrade when you are ready
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#f8fafb] text-[#5c6670] text-sm font-medium mb-4">Free Trial</div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-[#002045]">UGX 0</span>
                <span className="text-[#5c6670] ml-1">/ 30 days</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['Up to 100 students', 'All basic features', 'SMS credits included', 'Email support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#5c6670]">
                    <MaterialIcon icon="check_circle" className="text-[#006e1c]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn btn-secondary w-full">
                Start Free
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-[#002045] p-6 text-left relative">
              <div className="absolute top-0 right-0 bg-[#002045] text-white px-3 py-1 rounded-bl-xl rounded-tr-xl text-xs font-medium">
                Popular
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#e3f2fd] text-[#002045] text-sm font-medium mb-4">Premium</div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-[#002045]">UGX 50,000</span>
                <span className="text-[#5c6670] ml-1">/ term</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['Unlimited students', 'All features', 'SMS included', 'Priority support', 'Report printing'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#5c6670]">
                    <MaterialIcon icon="check_circle" className="text-[#006e1c]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn btn-primary w-full">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e8eaed] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <SchoolXLogo size="sm" />
            <p className="text-sm text-[#5c6670]">
              Built for Ugandan Schools
            </p>
            <div className="flex gap-4">
              <Link href="/login" className="text-sm text-[#5c6670] hover:text-[#002045]">
                Sign In
              </Link>
              <Link href="/register" className="text-sm text-[#5c6670] hover:text-[#002045]">
                Register
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}