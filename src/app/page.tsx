'use client'
import Link from 'next/link'
import SchoolXLogo from '@/components/SchoolXLogo'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
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

      {/* Hero Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="badge badge-info mb-6">
            School Management Made Simple
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            Manage your school<br />
            <span className="text-blue-600">the easy way</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Track students, record grades, manage fees, and send SMS to parents.
            Everything your school needs in one simple system.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn btn-primary text-base px-8 py-4">
              Start Free Trial
            </Link>
            <Link href="/login" className="btn btn-secondary text-base px-8 py-4">
              Sign In to Account
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            30 days free. No credit card needed.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything your school needs
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Simple tools that work for primary and secondary schools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Student Records',
                description: 'Keep all student information in one place. Names, contacts, class details, and more.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                ),
              },
              {
                title: 'Grade Reports',
                description: 'Record marks, calculate averages, and print report cards for parents.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
              },
              {
                title: 'Fee Management',
                description: 'Track school fees, record payments, and see who still owes money.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                title: 'Attendance',
                description: 'Mark daily attendance and see who is present, absent, or late.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
              },
              {
                title: 'SMS to Parents',
                description: 'Send messages to parents about fees, events, or student progress.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                ),
              },
              {
                title: 'Timetable',
                description: 'Create and manage class timetables for each term.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
            ].map((feature, i) => (
              <div key={i} className="card">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Simple pricing
          </h2>
          <p className="text-lg text-gray-600 mb-12">
            Start free, upgrade when you are ready
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="card text-left">
              <div className="badge badge-neutral mb-4">Free Trial</div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">UGX 0</span>
                <span className="text-gray-500 ml-1">/ 30 days</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['Up to 100 students', 'All basic features', 'SMS credits included', 'Email support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn btn-secondary w-full">
                Start Free
              </Link>
            </div>

            <div className="card text-left border-blue-200 bg-blue-50/30">
              <div className="badge badge-info mb-4">Premium</div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">UGX 50,000</span>
                <span className="text-gray-500 ml-1">/ term</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['Unlimited students', 'All features', 'SMS included', 'Priority support', 'Report printing'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <SchoolXLogo size="sm" />
            <p className="text-sm text-gray-500">
              Built for Ugandan Schools
            </p>
            <div className="flex gap-4">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                Sign In
              </Link>
              <Link href="/register" className="text-sm text-gray-500 hover:text-gray-900">
                Register
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
