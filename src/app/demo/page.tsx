import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import { DemoForm } from "@/components/marketing/DemoForm";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Request a Demo — ${APP_NAME}`,
  description:
    "See SkoolMate OS in action. Book a free personalized demo for your school. We'll walk you through attendance, fees, grades, and more.",
  openGraph: {
    title: `Request a Demo — ${APP_NAME}`,
    description: "See SkoolMate OS in action. Free personalized demo for your school.",
  },
};

export default function DemoPage() {
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

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#17325F] shadow-sm">
                <MaterialIcon icon="play_circle" className="text-sm" />
                See it in action
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                See SkoolMate OS in action.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                Schedule a free, no-obligation demo. We will show you how your school can use SkoolMate OS for
                attendance, fees, grades, reports, and parent communication — all in one place.
              </p>
            </div>
          </FadeIn>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <FadeIn>
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-950">What you will see</h2>
                <div className="mt-6 space-y-4">
                  {[
                    {
                      icon: "how_to_reg",
                      title: "Attendance tracking",
                      desc: "How teachers mark attendance on their phones and admin sees a live view.",
                    },
                    {
                      icon: "payments",
                      title: "Fee collection & mobile money",
                      desc: "How MTN MoMo and Airtel Money sync automatically with fee records.",
                    },
                    {
                      icon: "fact_check",
                      title: "Grading & report cards",
                      desc: "How CA and exam marks become NCDC-compliant report cards.",
                    },
                    {
                      icon: "sms",
                      title: "Parent communication",
                      desc: "How bulk SMS and the parent portal keep families informed.",
                    },
                    {
                      icon: "dashboard",
                      title: "Dashboard & reporting",
                      desc: "How school leaders see attendance, fees, and performance in one view.",
                    },
                    {
                      icon: "wifi_off",
                      title: "Offline mode",
                      desc: "How the system works without internet and syncs when connected.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448] flex-shrink-0">
                        <MaterialIcon icon={item.icon} className="text-[20px]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={100}>
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-950">Book a demo</h2>
                <p className="mt-2 text-sm text-slate-500">Fill in your details and we will schedule a call.</p>
                <div className="mt-6">
                  <DemoForm />
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Trust */}
        <section className="bg-[#f2f6fe] py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">Still deciding?</h2>
                <p className="mt-4 text-base text-slate-600">
                  Start a free trial instead. No credit card needed. Full access for 30 days.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                    Start free trial
                  </Link>
                  <Link href="/contact" className="btn btn-secondary px-7 py-4 text-base">
                    Talk to us
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
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
                      Request Demo
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
                    <Link href="/contact" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="text-sm text-slate-600 hover:text-slate-900 transition">
                      Register School
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
