import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Use Cases — ${APP_NAME}`,
  description:
    "Illustrative scenarios showing how Ugandan schools can use SkoolMate OS for attendance, fees, grading, and parent communication.",
  openGraph: {
    title: `Use Cases — ${APP_NAME}`,
    description: "How schools can use SkoolMate OS.",
  },
};

const caseStudies = [
  {
    school: "Urban secondary school",
    type: "Secondary, Urban",
    scenario: true,
    quote:
      "Illustrative scenario: attendance tracking can go from ~45 minutes per class to under 2 minutes, so staff know who is in school before the first lesson starts.",
    results: [
      "Daily attendance capture per class in minutes, not a full lesson",
      "Report card generation in under a day instead of weeks",
      "Fee collection via mobile money without manual reconciliation",
    ],
    icon: "school",
  },
  {
    school: "Primary school in a peri-urban area",
    type: "Primary, Peri-urban",
    scenario: true,
    quote:
      "Illustrative scenario: instead of separate ledgers for fees, attendance, and grades, everything lives in one place the head teacher can review on a phone.",
    results: [
      "No duplicate data entry across separate systems",
      "Parents reached by SMS about fees, attendance, and results",
      "End-of-term reporting time cut dramatically",
    ],
    icon: "stars",
  },
  {
    school: "Boarding secondary school",
    type: "Secondary, Boarding",
    scenario: true,
    quote:
      "Illustrative scenario: UNEB registration and large end-of-term batches move from days of manual data entry to a short automated run.",
    results: [
      "UNEB registration prepared in a single session instead of days",
      "Report cards generated in bulk and aligned with current standards",
      "Dormitory and house attendance tracked centrally",
    ],
    icon: "insights",
  },
  {
    school: "Rural school with limited connectivity",
    type: "Primary, Rural",
    scenario: true,
    quote:
      "Illustrative scenario: the app is designed to work with limited connectivity, with offline-first entry that syncs when a connection is available.",
    results: [
      "Attendance captured on phones even with patchy connectivity",
      "Digital records for every student instead of paper registers",
      "Parents receive updates by SMS where SMS is available",
    ],
    icon: "wifi_off",
  },
];

export default function CaseStudiesPage() {
  return (
    <PageErrorBoundary>
      <main className="min-h-screen bg-[var(--bg)] text-[var(--t1)]">
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

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#17325F] shadow-sm">
                <MaterialIcon icon="stars" className="text-sm" />
                Use cases
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                How schools run better with SkoolMate OS.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                Illustrative scenarios of how Ugandan schools can use SkoolMate OS to save time, improve accuracy, and
                keep parents informed.
              </p>
            </div>
          </FadeIn>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-6 md:grid-cols-2">
            {caseStudies.map((cs, i) => (
              <FadeIn key={cs.school} delay={i * 100}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                      <MaterialIcon icon={cs.icon} className="text-[20px]" />
                    </div>
                    <div>
                      <h3 className="font-['Sora'] text-base font-semibold text-slate-900">{cs.school}</h3>
                      <p className="text-xs text-slate-500">{cs.type}</p>
                    </div>
                  </div>
                  <blockquote className="flex-1">
                    <p className="text-sm leading-6 text-slate-600 italic">&ldquo;{cs.quote}&rdquo;</p>
                  </blockquote>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      What it looks like
                    </p>
                    <ul className="space-y-1.5">
                      {cs.results.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-xs text-slate-700">
                          <MaterialIcon icon="check" className="text-[var(--green)] text-[14px] mt-0.5 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-[36px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--sh1)] sm:px-8 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--t1)]">
                  Be the next success story
                </h2>
                <p className="mt-3 text-base leading-7 text-[var(--t2)]">
                  Start your free trial today. No credit card required.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
                <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                  Start free trial
                </Link>
                <Link href="/demo" className="btn btn-secondary px-7 py-4 text-base">
                  Book a demo
                </Link>
              </div>
            </div>
          </FadeIn>
        </section>

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
                    <Link href="/demo" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Demo
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Resources</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="/faq" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link href="/case-studies" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Case Studies
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
