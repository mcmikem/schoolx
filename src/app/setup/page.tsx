"use client";
import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";
import OwlStage from "@/components/brand/OwlStage";
import OwlMascot from "@/components/brand/OwlMascot";

export default function SetupPage() {
  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#edf4ff_0%,#f7f4ec_56%,#f2ede2_100%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-[36px] border border-white/60 bg-white/84 shadow-[0_32px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-[#e5ebf3] p-6 lg:border-b-0 lg:border-r lg:p-8">
            <OwlStage
              eyebrow="Setup guidance"
              title="Configuration required before launch"
              description="The owl has checked the essentials and found missing Supabase environment values. Add them once, redeploy, and the app will open normally."
              chips={[
                "Supabase connection",
                "Vercel environment",
                "One-time setup",
              ]}
            />
          </div>
          <div className="p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-[20px] border border-[#e1e8f0] bg-white shadow-lg ring-1 ring-slate-100">
                <AnimatedLogo type="logo" className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-800">
                  Configuration Required
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Finish these values and return to login.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#fbfcfe_0%,#f5f7fb_100%)] p-5 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Required Environment Variables
                </p>
                <ul className="space-y-3 text-sm font-mono text-slate-700">
                  <li className="flex items-start gap-3 rounded-2xl border border-[#f2dede] bg-white px-4 py-3">
                    <OwlMascot size={28} premium />
                    <span>NEXT_PUBLIC_SUPABASE_URL</span>
                  </li>
                  <li className="flex items-start gap-3 rounded-2xl border border-[#f2dede] bg-white px-4 py-3">
                    <OwlMascot size={28} premium />
                    <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-[26px] border border-[#d7e5ff] bg-[linear-gradient(180deg,#eef5ff_0%,#e8f1ff_100%)] p-5 text-sm leading-relaxed text-blue-800">
                <p className="mb-2 font-semibold">How to fix this</p>
                <ol className="list-decimal list-inside space-y-2 text-blue-700">
                  <li>
                    Go to your{" "}
                    <span className="font-semibold">
                      Vercel project → Settings → Environment Variables
                    </span>
                  </li>
                  <li>
                    Add the two variables above from your Supabase project
                    dashboard
                  </li>
                  <li>Redeploy the project</li>
                </ol>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-slate-400">
                Already configured?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  Go to Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
