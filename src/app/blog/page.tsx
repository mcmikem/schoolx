import type { Metadata } from "next";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Blog — ${APP_NAME}`,
  description: "Read about school management tips, education technology in Uganda, and updates from SkoolMate OS.",
  openGraph: {
    title: `Blog — ${APP_NAME}`,
    description: "School management insights, EdTech in Uganda, and SkoolMate OS updates.",
  },
};

const posts = [
  {
    title: "Why Ugandan schools are moving from paper registers to digital attendance",
    excerpt:
      "Paper registers have been the backbone of Ugandan schools for decades. But as schools grow, the limitations become impossible to ignore.",
    date: "June 15, 2026",
    category: "School Management",
  },
  {
    title: "How to reduce fee collection delays with mobile money integration",
    excerpt:
      "MTN MoMo and Airtel Money have transformed payments in Uganda. Schools that integrate mobile money see faster fee collection and fewer arrears.",
    date: "May 28, 2026",
    category: "Fees & Finance",
  },
  {
    title: "NCDC 2025 curriculum changes: What schools need to know",
    excerpt:
      "The new NCDC curriculum brings significant changes to assessment, grading, and reporting. Here is how SkoolMate OS helps schools stay aligned.",
    date: "April 10, 2026",
    category: "Academics",
  },
  {
    title: "Offline school management: Why it matters for rural Ugandan schools",
    excerpt:
      "Internet connectivity remains a challenge in many parts of Uganda. School management systems that work offline are not a luxury — they are a necessity.",
    date: "March 22, 2026",
    category: "Technology",
  },
];

export default function BlogPage() {
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
                <MaterialIcon icon="rss_feed" className="text-sm" />
                Blog
              </span>
              <h1 className="mt-6 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
                Insights &amp; updates
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                School management tips, education technology in Uganda, and what we are building at SkoolMate OS.
              </p>
            </div>
          </FadeIn>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post, i) => (
              <FadeIn key={post.title} delay={i * 80}>
                <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                      {post.category}
                    </span>
                    <span className="text-[10px] text-slate-400">&middot;</span>
                    <span className="text-[10px] text-slate-400">{post.date}</span>
                  </div>
                  <h2 className="font-['Sora'] text-lg font-semibold text-slate-900 leading-snug">{post.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 flex-1">{post.excerpt}</p>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <span className="text-xs font-semibold text-[var(--primary)]">Read more &rarr;</span>
                  </div>
                </article>
              </FadeIn>
            ))}
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
