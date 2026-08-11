import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import { modules, securityDetails } from "@/components/marketing/landing-data";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Features — ${APP_NAME}`,
  description:
    "Explore all SkoolMate OS features: student management, attendance, exams, fees, SMS, academic planning, and more — built for Ugandan schools.",
  openGraph: {
    title: `Features — ${APP_NAME}`,
    description:
      "Student records, attendance, exams, fees, SMS, and planning — all in one platform built for Ugandan schools.",
  },
};

const featureGroups = [
  {
    title: "Student Management",
    icon: "group",
    color: "bg-blue-50 text-[var(--brand-ink)]",
    features: [
      "Centralized student & parent records",
      "Admission & transfer management",
      "Digital student ID card generation",
      "Student profiles with fee & attendance history",
      "Bulk import via CSV/Excel",
    ],
  },
  {
    title: "Attendance & Registers",
    icon: "how_to_reg",
    color: "bg-green-50 text-[var(--brand-green)]",
    features: [
      "Daily attendance on any device",
      "Period-by-period class registers",
      "Live attendance dashboard for admin",
      "Auto-flagging of low attendance",
      "Offline mode — syncs when connected",
    ],
  },
  {
    title: "Exams, Grades & Reports",
    icon: "fact_check",
    color: "bg-purple-50 text-[#7c3aed]",
    features: [
      "CA, mid-term & end-of-term exam entry",
      "Automated grade calculation",
      "NCDC-compliant report cards",
      "UNEB candidate registration",
      "MoES exports & board reports",
    ],
  },
  {
    title: "Fees, Payroll & Budgets",
    icon: "payments",
    color: "bg-amber-50 text-[var(--brand-accent)]",
    features: [
      "Fee structure & collection tracking",
      "MTN MoMo & Airtel Money integration",
      "Automated receipts & invoices",
      "Full payroll management",
      "Budget tracking & audit logs",
    ],
  },
  {
    title: "Communication & SMS",
    icon: "sms",
    color: "bg-teal-50 text-[#0d9488]",
    features: [
      "Bulk SMS to parents & staff",
      "Fee reminder automation",
      "Parent portal for results & updates",
      "Event & closing notifications",
      "SMS delivery tracking",
    ],
  },
  {
    title: "Academic Planning",
    icon: "assignment",
    color: "bg-indigo-50 text-[#4f46e5]",
    features: [
      "NCDC syllabus & scheme of work",
      "Lesson plans & homework assignments",
      "DNA analysis & student trend tracking",
      "Staff leave & substitution management",
      "Library & dorm management",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PageErrorBoundary>
      <main className="min-h-screen bg-[var(--bg)] text-[var(--t1)]">
        {/* Nav */}
        <nav className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
            <Link href="/">
              <SkoolMateLogo size="md" variant="default" />
            </Link>
            <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <Link href="/features" className="transition hover:text-slate-950">
                Features
              </Link>
              <Link href="/pricing" className="transition hover:text-slate-950">
                Pricing
              </Link>
              <Link href="/demo" className="transition hover:text-slate-950">
                Demo
              </Link>
              <Link href="/blog" className="transition hover:text-slate-950">
                Blog
              </Link>
              <Link href="/about" className="transition hover:text-slate-950">
                About
              </Link>
              <Link href="/contact" className="transition hover:text-slate-950">
                Contact
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Start free trial
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-ink)] shadow-sm">
                <MaterialIcon icon="travel_explore" className="text-sm" />
                Everything in one platform
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                Every tool your school needs.
                <br />
                <span className="text-[var(--green)]">Nothing it doesn&apos;t.</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                SkoolMate OS brings together student management, academics, fees, communication, and planning — so your
                school runs from one place instead of ten.
              </p>
            </div>
          </FadeIn>
        </section>

        {/* Feature Groups */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureGroups.map((group, i) => (
              <FadeIn key={group.title} delay={i * 80}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${group.color}`}>
                    <MaterialIcon icon={group.icon} className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{group.title}</h3>
                  <ul className="mt-4 space-y-2.5 flex-1">
                    {group.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <MaterialIcon icon="check" className="text-[var(--green)] text-[18px] mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Modules from landing-data */}
        <section className="bg-[var(--brand-surface-muted)] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="font-['Sora'] text-3xl font-semibold text-slate-950 sm:text-4xl">
                  Core platform modules
                </h2>
                <p className="mt-4 text-lg text-slate-600">
                  Every module is designed to reduce duplicate work. Enter data once, use it everywhere.
                </p>
              </div>
            </FadeIn>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              {modules.map((mod, i) => (
                <FadeIn key={mod.label} delay={i * 80}>
                  <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm hover:shadow-md hover:border-[var(--brand-green)]/30 transition-all flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-green-soft)] text-[var(--brand-green)] flex-shrink-0">
                      <MaterialIcon icon={mod.icon} className="text-[22px]" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{mod.label}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="font-['Sora'] text-3xl font-semibold text-slate-950 sm:text-4xl">
                Security & data protection
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Student records and financial data are sensitive. Here is how we protect your school.
              </p>
            </div>
          </FadeIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {securityDetails.map((item, i) => (
              <FadeIn key={item.title} delay={i * 100}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[var(--brand-green)]/30 transition-all h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-green-soft)] text-[var(--brand-green)]">
                    <MaterialIcon icon={item.icon} className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-[36px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--sh1)] sm:px-8 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--t1)]">
                  Ready to see it in action?
                </h2>
                <p className="mt-3 text-base leading-7 text-[var(--t2)]">
                  Start your free trial. No credit card required. Set up your school in minutes.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
                <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                  Start free trial
                </Link>
                <Link href="/contact" className="btn btn-secondary px-7 py-4 text-base">
                  Talk to us
                </Link>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <SkoolMateLogo size="md" variant="default" />
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  The school operating system built from real experience in Ugandan schools.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Product</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/features" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      About
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Resources</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Register School
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Legal</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/privacy" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-10 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400">
                &copy; {new Date().getFullYear()} Omuto Foundation. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </PageErrorBoundary>
  );
}
