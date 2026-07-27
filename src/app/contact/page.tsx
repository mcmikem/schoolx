import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import { ContactForm } from "@/components/marketing/ContactForm";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Contact — ${APP_NAME}`,
  description:
    "Get in touch with the SkoolMate OS team. Email, phone, WhatsApp, or send us a message. We respond within 24 hours.",
  openGraph: {
    title: `Contact — ${APP_NAME}`,
    description: "Reach the SkoolMate OS team via email, phone, WhatsApp, or contact form. We're here to help.",
  },
};

export default function ContactPage() {
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
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#17325F] shadow-sm">
                <MaterialIcon icon="chat" className="text-sm" />
                Get in touch
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                We&apos;d love to hear from you.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                Questions about SkoolMate OS? Want a demo? Need help getting started? Reach out — we respond within a
                few hours.
              </p>
            </div>
          </FadeIn>
        </section>

        {/* Contact grid */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            {/* Contact info */}
            <div className="space-y-5">
              <FadeIn>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                    <MaterialIcon icon="mail" className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">Email</h3>
                  <a href="mailto:os@omuto.org" className="mt-2 block text-sm text-[var(--primary)] hover:underline">
                    os@omuto.org
                  </a>
                  <p className="mt-1 text-xs text-slate-500">We reply within 24 hours</p>
                </div>
              </FadeIn>

              <FadeIn delay={100}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                    <MaterialIcon icon="phone" className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">Phone</h3>
                  <a href="tel:0750028703" className="mt-2 block text-sm text-[var(--primary)] hover:underline">
                    0750 028 703
                  </a>
                  <p className="mt-1 text-xs text-slate-500">Monday&ndash;Friday, 8:00 AM&ndash;5:00 PM</p>
                </div>
              </FadeIn>

              <FadeIn delay={200}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
                    <MaterialIcon icon="chat" className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">WhatsApp</h3>
                  <a
                    href="https://wa.me/256750028703"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-sm text-[var(--primary)] hover:underline"
                  >
                    Chat on WhatsApp
                  </a>
                  <p className="mt-1 text-xs text-slate-500">Fastest way to get a response</p>
                </div>
              </FadeIn>

              <FadeIn delay={300}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                    <MaterialIcon icon="location_on" className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">Location</h3>
                  <p className="mt-2 text-sm text-slate-600">Kampala, Uganda</p>
                  <p className="text-xs text-slate-500">Omuto Foundation</p>
                </div>
              </FadeIn>
            </div>

            {/* Form */}
            <FadeIn delay={100}>
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-950">Send us a message</h2>
                <p className="mt-2 text-sm text-slate-500">Fill in the form and we&apos;ll get back to you.</p>
                <div className="mt-8">
                  <ContactForm />
                </div>
              </div>
            </FadeIn>
          </div>
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
