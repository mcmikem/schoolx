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
            <div className="hidden items-center gap-8 text-sm font-medium text-[var(--t2)] md:flex">
              <Link href="/features" className="transition hover:text-[var(--t3)]">
                Features
              </Link>
              <Link href="/pricing" className="transition hover:text-[var(--t3)]">
                Pricing
              </Link>
              <Link href="/about" className="transition hover:text-[var(--t3)]">
                About
              </Link>
              <Link href="/contact" className="transition hover:text-[var(--t3)]">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--t1)] shadow-sm">
              <MaterialIcon icon="gavel" className="text-sm" />
              Legal
            </span>
            <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-[var(--t3)] sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm text-[var(--t3)]">Last updated: 9 November 2026</p>
          </FadeIn>

          <div className="mt-12 space-y-8 text-sm leading-7 text-[var(--t2)]">
            <FadeIn>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">1. Acceptance of Terms</h2>
              <p className="mt-3">
                By accessing or using SkoolMate OS (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of
                Service. If you do not agree, do not use the Platform. These terms apply to all users, including
                schools, administrators, teachers, parents, and students.
              </p>
            </FadeIn>

            <FadeIn delay={50}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">2. Description of Service</h2>
              <p className="mt-3">
                SkoolMate OS is a school management platform provided by Omuto Foundation. It offers tools for
                attendance tracking, grade management, fee collection, communication, and other school operations. The
                Platform is accessed via web browser or mobile application.
              </p>
            </FadeIn>

            <FadeIn delay={100}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">3. Account Registration</h2>
              <p className="mt-3">
                You must register an account to use the Platform. You are responsible for maintaining the
                confidentiality of your login credentials and for all activities under your account. You must provide
                accurate, current, and complete information during registration.
              </p>
            </FadeIn>

            <FadeIn delay={150}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">4. Fees and Payment</h2>
              <p className="mt-3">
                Fees are calculated per student per term, as published on our pricing page. Payments are due at the
                start of each term. Late payments may result in service suspension. All fees are non-refundable except
                as required by applicable law.
              </p>
            </FadeIn>

            <FadeIn delay={200}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">5. Data Ownership and Privacy</h2>
              <p className="mt-3">
                The school retains its rights in records it provides or creates using the Platform. For learner and
                school records, the school generally determines the purposes and means of processing, and Omuto
                Foundation processes those records to provide the Platform and follow the school&apos;s documented
                instructions. Omuto may act independently for account, billing, security, and support operations. We do
                not use school records for advertising or AI model training. Our Privacy Notice explains the data
                categories and service-provider roles.
              </p>
            </FadeIn>

            <FadeIn delay={225}>
              <section
                id="school-data-processing"
                className="scroll-mt-8 rounded-2xl border border-[var(--border)] bg-white p-6"
              >
                <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">
                  School Agreement: Data Processing
                </h2>
                <p className="mt-3">
                  By registering a school, the person completing registration confirms they are authorised to accept
                  these terms for the school. This section applies when the school uses SkoolMate to store or otherwise
                  process personal data for which the school is responsible.
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>
                    <strong>Subject and duration:</strong> Omuto processes personal data in order to host and provide
                    SkoolMate features for the duration of the school&apos;s subscription and any agreed transition or
                    retention period.
                  </li>
                  <li>
                    <strong>Nature and purposes:</strong> Processing may include collecting, organising, storing,
                    displaying, updating, exporting, backing up, and transmitting records to provide school
                    administration, teaching, communication, reporting, and support features selected by the school.
                  </li>
                  <li>
                    <strong>Data and people:</strong> Depending on the features used, records may concern learners,
                    parents or guardians, school staff, and school representatives, and may include identity, education,
                    attendance, contact, payment, health, or other information the school chooses to enter.
                  </li>
                  <li>
                    <strong>School responsibilities:</strong> The school must use the Platform lawfully, determine and
                    document its lawful basis, provide required notices, obtain any required permissions, limit data to
                    what is necessary, keep it accurate, and configure staff access appropriately. The school must not
                    enter information it has no authority to process.
                  </li>
                  <li>
                    <strong>Omuto responsibilities:</strong> Omuto will process school records only to provide and
                    secure the service, follow documented school instructions, restrict access to people who need it and
                    are subject to confidentiality duties, and maintain appropriate technical and organisational
                    safeguards. Omuto will notify the school of a confirmed personal-data breach affecting its records
                    without undue delay after becoming aware, and reasonably assist with data-subject requests and the
                    school&apos;s compliance duties.
                  </li>
                  <li>
                    <strong>Service providers and transfers:</strong> The school authorises use of service providers
                    needed to host, secure, communicate through, and support the Platform, subject to appropriate
                    written obligations. Before enabling a new provider or processing location for school records, Omuto
                    will make the applicable provider and location information available to the school and address any
                    required transfer safeguards.
                  </li>
                  <li>
                    <strong>Requests and end of service:</strong> Omuto will direct requests concerning school records
                    to the school where the school is the controller, and will reasonably assist the school. At the end
                    of service, the school may request return or deletion, subject to applicable legal retention duties,
                    agreed timelines, and backup cycles.
                  </li>
                </ul>
                <p className="mt-3">
                  The school remains responsible for decisions about learner records and for responding to requests from
                  learners, parents, guardians, and staff. Contact{" "}
                  <a href="mailto:os@omuto.org" className="text-[var(--primary)] hover:underline">
                    os@omuto.org
                  </a>{" "}
                  to request the current service-provider schedule or discuss a written school-specific addendum.
                </p>
              </section>
            </FadeIn>

            <FadeIn delay={250}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">6. Data Export and Deletion</h2>
              <p className="mt-3">
                Authorized school users may request an export. Upon cancellation, access continues until the end of the
                current term. The school may then request return or deletion of its data, handled under the school
                agreement, applicable retention duties, and the documented return or deletion process. Timing depends on
                the data and any required retention or backup cycle; contact us to arrange a request.
              </p>
            </FadeIn>

            <FadeIn delay={300}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">7. Acceptable Use</h2>
              <p className="mt-3">
                You agree not to misuse the Platform, including but not limited to: attempting to access another
                user&apos;s account, uploading malicious code, interfering with Platform operations, or using the
                Platform for unlawful purposes. Violations may result in immediate account termination.
              </p>
            </FadeIn>

            <FadeIn delay={350}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">
                8. Service Level and Availability
              </h2>
              <p className="mt-3">
                We strive to maintain 99.9% uptime, but do not guarantee uninterrupted access. The Platform includes
                offline capabilities to mitigate connectivity issues. We reserve the right to perform maintenance with
                reasonable notice.
              </p>
            </FadeIn>

            <FadeIn delay={400}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">9. Limitation of Liability</h2>
              <p className="mt-3">
                Omuto Foundation shall not be liable for indirect, incidental, or consequential damages arising from the
                use of the Platform. Our total liability is limited to the fees paid by you in the 12 months preceding
                the claim. This does not affect your statutory rights.
              </p>
            </FadeIn>

            <FadeIn delay={450}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">10. Termination</h2>
              <p className="mt-3">
                Either party may terminate this agreement at any time. Upon termination by you, we will provide data
                export assistance. We may terminate or suspend access for breach of these terms, with notice where
                possible.
              </p>
            </FadeIn>

            <FadeIn delay={500}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">11. Changes to Terms</h2>
              <p className="mt-3">
                We may update these terms from time to time. We will notify you of material changes via email or
                Platform notice. Continued use after changes take effect constitutes acceptance of the new terms.
              </p>
            </FadeIn>

            <FadeIn delay={550}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">12. Governing Law</h2>
              <p className="mt-3">
                These terms are governed by the laws of the Republic of Uganda. Any disputes shall be resolved through
                amicable negotiation first, and if unresolved, through the courts of Uganda.
              </p>
            </FadeIn>

            <FadeIn delay={600}>
              <h2 className="font-['Sora'] text-xl font-semibold text-[var(--t1)]">13. Contact</h2>
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
        <footer className="border-t border-[var(--border)] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <SkoolMateLogo size="md" variant="default" />
                <p className="mt-4 text-sm leading-6 text-[var(--t3)]">
                  The school operating system built from real experience in Ugandan schools.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--t3)]">Product</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/features" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      About
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--t3)]">Resources</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/login" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Register School
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--t3)]">Legal</h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/privacy" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-sm text-[var(--t2)] hover:text-[var(--t1)] transition">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-10 border-t border-[var(--border)] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-[var(--t3)]">
                &copy; {new Date().getFullYear()} Omuto Foundation. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </PageErrorBoundary>
  );
}
