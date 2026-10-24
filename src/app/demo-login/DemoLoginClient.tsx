"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { saveDemoStorage } from "@/lib/auth-demo";

const DEMO_ACCOUNTS = [
  { label: "Admin", phone: "256700000001", target: "/dashboard" },
  { label: "Bursar", phone: "256700000002", target: "/dashboard" },
  { label: "Teacher", phone: "256700000003", target: "/dashboard" },
  { label: "DOS", phone: "256700000004", target: "/dashboard" },
  { label: "Parent", phone: "256700000005", target: "/parent-portal" },
] as const;

export default function DemoLoginClient() {
  const router = useRouter();
  const [phone, setPhone] = useState<string>(DEMO_ACCOUNTS[0].phone);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/demo-login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "Demo sign-in failed");
        return;
      }
      saveDemoStorage(data.user, data.school);
      const target = data.user?.role === "parent" ? "/parent-portal" : "/dashboard";
      router.replace(target);
    } catch {
      setError("Could not reach the demo server. Check that the dev server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f5fc] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mb-6">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <MaterialIcon icon="arrow_back" size={16} />
            Back to sign in
          </Link>
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-1">Demo sign-in</h1>
        <p className="text-sm text-slate-600 mb-5">
          Development only. Pick a role, enter the demo password, and continue.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.phone}
              type="button"
              onClick={() => setPhone(account.phone)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                phone === account.phone
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              <span className="block font-medium">{account.label}</span>
              <span className={`font-mono text-xs ${phone === account.phone ? "text-slate-300" : "text-slate-500"}`}>
                ...{account.phone.slice(-3)}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="demo-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone
            </label>
            <input
              id="demo-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="numeric"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label htmlFor="demo-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Demo password
            </label>
            <input
              id="demo-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
