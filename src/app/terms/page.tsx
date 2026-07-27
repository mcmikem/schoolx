import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
  description:
    "Terms of Service for SkoolMate OS by Omuto Foundation. Learn about your rights and obligations when using our school management platform.",
  openGraph: {
    title: `Terms of Service — ${APP_NAME}`,
    description: "Terms of Service for SkoolMate OS school management platform.",
  },
};

export default function TermsPage() {
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

        {/* Content */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#17325F] shadow-sm">
              <MaterialIcon icon="gavel" className="text-sm" />
              Legal
            </span>
            <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm text-slate-500">Last updated: July 2026</p>
          </FadeIn>

          <div className="mt-12 space-y-8 text-sm leading-7 text-slate-700">
            <FadeIn>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">1. Acceptance of Terms</h2>
              <p className="mt-3">
                By accessing or using SkoolMate OS (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of
                Service. If you do not agree, do not use the Platform. These terms apply to all users, including
                schools, administrators, teachers, parents, and students.
              </p>
            </FadeIn>

            <FadeIn delay={50}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">2. Description of Service</h2>
              <p className="mt-3">
                SkoolMate OS is a school management platform provided by Omuto Foundation. It offers tools for
                attendance tracking, grade management, fee collection, communication, and other school operations. The
                Platform is accessed via web browser or mobile application.
              </p>
            </FadeIn>

            <FadeIn delay={100}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">3. Account Registration</h2>
              <p className="mt-3">
                You must register an account to use the Platform. You are responsible for maintaining the
                confidentiality of your login credentials and for all activities under your account. You must provide
                accurate, current, and complete information during registration.
              </p>
            </FadeIn>

            <FadeIn delay={150}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">4. Fees and Payment</h2>
              <p className="mt-3">
                Fees are calculated per student per term, as published on our pricing page. Payments are due at the
                start of each term. Late payments may result in service suspension. All fees are non-refundable except
                as required by applicable law.
              </p>
            </FadeIn>

            <FadeIn delay={200}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">5. Data Ownership and Privacy</h2>
              <p className="mt-3">
                Your school&apos;s data belongs to you. Omuto Foundation does not claim ownership over any data you
                upload. We do not use school data for training, advertising, or any purpose other than operating the
                Platform. Our data handling practices are described in our Privacy Policy.
              </p>
            </FadeIn>

            <FadeIn delay={250}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">6. Data Export and Deletion</h2>
              <p className="mt-3">
                You may export your data at any time. Upon cancellation, you retain access until the end of your current
                term. After that, we delete your data within 30 days unless you request otherwise. We provide one free
                data export upon request after cancellation.
              </p>
            </FadeIn>

            <FadeIn delay={300}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">7. Acceptable Use</h2>
              <p className="mt-3">
                You agree not to misuse the Platform, including but not limited to: attempting to access another
                user&apos;s account, uploading malicious code, interfering with Platform operations, or using the
                Platform for unlawful purposes. Violations may result in immediate account termination.
              </p>
            </FadeIn>

            <FadeIn delay={350}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">8. Service Level and Availability</h2>
              <p className="mt-3">
                We strive to maintain 99.9% uptime, but do not guarantee uninterrupted access. The Platform includes
                offline capabilities to mitigate connectivity issues. We reserve the right to perform maintenance with
                reasonable notice.
              </p>
            </FadeIn>

            <FadeIn delay={400}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">9. Limitation of Liability</h2>
              <p className="mt-3">
                Omuto Foundation shall not be liable for indirect, incidental, or consequential damages arising from the
                use of the Platform. Our total liability is limited to the fees paid by you in the 12 months preceding
                the claim. This does not affect your statutory rights.
              </p>
            </FadeIn>

            <FadeIn delay={450}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">10. Termination</h2>
              <p className="mt-3">
                Either party may terminate this agreement at any time. Upon termination by you, we will provide data
                export assistance. We may terminate or suspend access for breach of these terms, with notice where
                possible.
              </p>
            </FadeIn>

            <FadeIn delay={500}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">11. Changes to Terms</h2>
              <p className="mt-3">
                We may update these terms from time to time. We will notify you of material changes via email or
                Platform notice. Continued use after changes take effect constitutes acceptance of the new terms.
              </p>
            </FadeIn>

            <FadeIn delay={550}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">12. Governing Law</h2>
              <p className="mt-3">
                These terms are governed by the laws of the Republic of Uganda. Any disputes shall be resolved through
                amicable negotiation first, and if unresolved, through the courts of Uganda.
              </p>
            </FadeIn>

            <FadeIn delay={600}>
              <h2 className="font-['Sora'] text-xl font-semibold text-slate-900">13. Contact</h2>
              <p className="mt-3">
                For questions about these terms, contact us at{" "}
                <a href="mailto:os@omuto.org" className="text-[var(--primary)] hover:underline">
                  os@omuto.org
                </a>{" "}
                or call{" "}
                <a href="tel:0750028703" className="text-[var(--primary)] hover:underline">
                  0750 028 703
                </a>
                .
              </p>
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
