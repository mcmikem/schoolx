"use client";
import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-[0_32px_64px_rgba(15,23,42,0.08)] border border-slate-100 p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white shadow-lg mb-5 ring-1 ring-slate-100">
            <AnimatedLogo type="logo" className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Configuration Required
          </h1>
          <p className="mt-2 text-slate-500 text-sm leading-relaxed max-w-sm">
            This app needs Supabase environment variables before it can start.
            Add the settings below to your Vercel project and redeploy.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Required Environment Variables
            </p>
            <ul className="space-y-2 text-sm font-mono text-slate-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-500 text-xs flex items-center justify-center font-bold">!</span>
                <span>NEXT_PUBLIC_SUPABASE_URL</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-500 text-xs flex items-center justify-center font-bold">!</span>
                <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800 leading-relaxed">
            <p className="font-semibold mb-1">How to fix this</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Go to your <span className="font-semibold">Vercel project → Settings → Environment Variables</span></li>
              <li>Add the two variables above from your Supabase project dashboard</li>
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
  );
}
