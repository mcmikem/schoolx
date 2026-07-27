import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { FadeIn } from "@/components/marketing/FadeIn";
import { FAQItem } from "@/components/marketing/FAQItem";
import { faqItems } from "@/components/marketing/landing-data";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `FAQ — ${APP_NAME}`,
  description: "Frequently asked questions about SkoolMate OS. Pricing, setup, offline mode, data privacy, and more.",
  openGraph: {
    title: `FAQ — ${APP_NAME}`,
    description: "Answers to common questions about SkoolMate OS school management platform.",
  },
};

export default function FAQPage() {
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

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center mb-12">
              <h1 className="font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl">
                Frequently asked questions
              </h1>
              <p className="mt-4 text-lg text-slate-600">Everything you need to know about SkoolMate OS.</p>
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

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-[28px] border border-slate-200 bg-[#f8fbff] p-6 text-center">
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">Still have questions?</h2>
              <p className="mt-2 text-sm text-slate-600">We are happy to help.</p>
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/contact" className="btn btn-primary px-6 py-3 text-sm">
                  Contact us
                </Link>
                <a href="tel:0750028703" className="btn btn-secondary px-6 py-3 text-sm">
                  Call 0750 028 703
                </a>
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
