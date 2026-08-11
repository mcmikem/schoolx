import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import { plans, faqItems } from "@/components/marketing/landing-data";
import Link from "next/link";
import { FAQItem } from "@/components/marketing/FAQItem";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Pricing — ${APP_NAME}`,
  description:
    "Limited time — 30% off all plans. Simple, per-student pricing for SkoolMate OS. Start free for 30 days. Plans from UGX 1,400/student/term.",
  openGraph: {
    title: `Pricing — ${APP_NAME}`,
    description:
      "30% off — per-student pricing starting at UGX 1,400/term. Free trial available. No credit card required.",
  },
};

export default function PricingPage() {
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
                <MaterialIcon icon="payments" className="text-sm" />
                Simple, transparent pricing
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                Per-student pricing.
                <br />
                <span className="text-[var(--green)]">No hidden fees.</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                Start free for 30 days. No credit card required. Pay only for the students you have.
              </p>
            </div>
          </FadeIn>
        </section>

        {/* Plans */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <strong className="text-slate-900">How billing works:</strong> Pick a plan below and pay per student per
            term — all features in that tier are included (Full Suite). Alternatively, choose <strong>Modular</strong>{" "}
            during registration — core modules are free based on your school size, and you add individual modules at
            annual prices. You're never charged both ways and can switch at any time.
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 150}>
                <div
                  className={`rounded-[32px] border p-6 h-full flex flex-col ${
                    plan.featured
                      ? "border-[var(--brand-ink)]/20 bg-white text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.08)]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-slate-950">{plan.name}</p>
                    {plan.featured && (
                      <span className="rounded-full bg-[var(--brand-ink)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                        Most chosen
                      </span>
                    )}
                    {(plan as any).promoBadge && (
                      <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white ml-2">
                        {(plan as any).promoBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                    {plan.price}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{plan.cadence}</p>
                  <p className="mt-1 text-xs text-slate-400">{plan.contrastLabel}</p>
                  <div className="mt-6 space-y-3 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      What&apos;s included
                    </p>
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <MaterialIcon icon="check" className="mt-0.5 text-[18px] text-[var(--brand-green)]" />
                        <p className="text-sm text-slate-700">{feature}</p>
                      </div>
                    ))}
                    {(plan as any).lossItems?.length > 0 && (
                      <>
                        <div className="my-3 border-t border-slate-200" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                          Not included on this plan
                        </p>
                        {(plan as any).lossItems.map((item: string) => (
                          <div key={item} className="flex items-start gap-3">
                            <MaterialIcon icon="close" className="mt-0.5 text-[16px] text-amber-400" />
                            <p className="text-sm text-slate-500">{item}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <Link
                    href="/register"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      plan.featured
                        ? "bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90"
                        : "bg-[var(--surface)] text-[var(--t1)] border border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                    }`}
                  >
                    Start with {plan.name}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section className="bg-[var(--brand-surface-muted)] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-10">
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                  How SkoolMate OS compares
                </h2>
              </div>
              <p className="text-center text-sm text-slate-500 mb-2">
                ✓ = Included &nbsp;&nbsp; ✗ = Not available &nbsp;&nbsp; ~ = Partial
              </p>
              <p className="text-center text-xs text-slate-400 mb-8">
                Based on publicly available information, April 2026. Competitor columns are illustrative.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Feature</th>
                      <th className="py-3 px-4 font-bold text-[var(--brand-green)] bg-green-50">SkoolMate</th>
                      <th className="py-3 px-4 text-slate-500">Alt A</th>
                      <th className="py-3 px-4 text-slate-500">Alt B</th>
                      <th className="py-3 px-4 text-slate-500">Alt C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["NCDC syllabus & scheme of work", "✓", "✗", "✗", "✗"],
                      ["MTN MoMo + Airtel integration", "✓", "~", "✗", "✗"],
                      ["Student ID card generation", "✓", "✗", "✗", "✗"],
                      ["Transport route tracking", "✓", "✗", "✗", "✗"],
                      ["DNA + trend analysis", "✓", "✗", "✗", "✗"],
                      ["White-label option", "✓", "✗", "✗", "✗"],
                      ["Parent portal", "✓", "✓", "✓", "✗"],
                      ["Offline mode", "~", "✓", "✗", "✓"],
                      ["UNEB registration", "✓", "~", "✗", "✗"],
                      ["Full payroll", "✓", "✓", "✓", "~"],
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-700">{row[0]}</td>
                        <td className="py-3 px-4 text-center font-bold bg-green-50/50">{row[1]}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{row[2]}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{row[3]}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center mb-10">
              <h2 className="font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                Frequently asked questions
              </h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <FadeIn key={item.q} delay={i * 80}>
                  <FAQItem q={item.q} a={item.a} />
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-[36px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--sh1)] sm:px-8 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--t1)]">
                  Start your free trial today
                </h2>
                <p className="mt-3 text-base leading-7 text-[var(--t2)]">
                  No credit card required. Full access for 30 days.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
                <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                  Start free trial
                </Link>
                <Link href="/contact" className="btn btn-secondary px-7 py-4 text-base">
                  Talk to sales
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
