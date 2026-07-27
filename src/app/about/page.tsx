import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import { storyMoments, storyPrinciples } from "@/components/marketing/landing-data";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `About — ${APP_NAME}`,
  description:
    "SkoolMate OS was built from real experience in Ugandan schools. Learn the story behind the school operating system by Omuto Foundation.",
  openGraph: {
    title: `About — ${APP_NAME}`,
    description:
      "Built from real experience in Ugandan schools. SkoolMate OS is the story of understanding what schools actually need.",
  },
};

export default function AboutPage() {
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
                <MaterialIcon icon="school" className="text-sm" />
                Our story
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                It did not start as an idea.
                <br />
                <span className="text-[var(--green)]">It started with what schools kept carrying.</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                At Omuto Foundation, we&apos;ve been close enough to schools to see the real picture. The issue was
                never that people were not trying. The issue was that the system around them kept slowing the work down.
              </p>
            </div>
          </FadeIn>
        </section>

        {/* Story moments */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <FadeIn>
              <div className="rounded-[34px] bg-[#0f1f3d] p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">What we saw</p>
                <div className="mt-6 grid gap-3">
                  {storyMoments.map((item) => (
                    <div key={item} className="story-card rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                      <p className="text-sm leading-6 text-white/82">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            <div className="grid gap-5">
              <FadeIn>
                <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    What became obvious
                  </p>
                  <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950">
                    Schools do not need more pressure. They need better tools.
                  </h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    SkoolMate OS was built to match the real flow of school life: attendance, marks, fees,
                    communication, and decision-making in one place. Not another generic system. A calmer operating
                    layer for schools that are already working hard.
                  </p>
                </div>
              </FadeIn>

              <div className="grid gap-4 sm:grid-cols-2">
                {storyPrinciples.map((item, i) => (
                  <FadeIn key={item.label} delay={i * 100}>
                    <div className="story-card rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-sm h-full">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                        <MaterialIcon icon={item.icon} className="text-[20px]" />
                      </div>
                      <p className="mt-4 text-base font-semibold leading-7 text-slate-900">{item.label}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>

              <FadeIn delay={200}>
                <div className="rounded-[34px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-sm lg:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    What changes when the system runs well
                  </p>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    Teachers get more time to focus on students. Leaders can see what is working and what is not.
                    Parents stay informed. Students are noticed early instead of slipping through the cracks. The X in
                    SkoolMate OS stands for Xperience, because this system comes from what has been seen, learned, and
                    asked for in the field.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-[#0d1930] py-16 text-white lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="font-['Sora'] text-3xl font-semibold sm:text-4xl">Our mission</h2>
                <p className="mt-6 text-lg leading-8 text-white/72">
                  To give every Ugandan school — from rural primary to urban secondary — the same operational clarity
                  that the best-funded schools have. Not through expensive consultants or complex software, but through
                  a system designed for the way schools actually work.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-[36px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--sh1)] sm:px-8 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--t1)]">
                  Join schools already using SkoolMate OS
                </h2>
                <p className="mt-3 text-base leading-7 text-[var(--t2)]">
                  Start your free trial today. No credit card needed.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
                <Link href="/register" className="btn btn-primary px-7 py-4 text-base">
                  Start free trial
                </Link>
                <Link href="/contact" className="btn btn-secondary px-7 py-4 text-base">
                  Get in touch
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
