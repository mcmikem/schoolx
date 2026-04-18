"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { getErrorMessage } from "@/lib/validation";

export default function SetupAdminPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
  });

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.name.trim()) {
      setError("Name is required");
      setLoading(false);
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required");
      setLoading(false);
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Setup failed')
      }

      setDone(true);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Setup failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--primary)] to-[var(--primary-700)] flex items-center justify-center px-4">
        <div className="bg-[var(--surface)] rounded-2xl shadow-[var(--sh2)] border border-[var(--border)] w-full max-w-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-[var(--green)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--t1)] mb-2">
            Super Admin Created!
          </h2>
          <p className="text-[var(--t3)] mb-6">
            Login with your phone number: <strong>{form.phone}</strong>
          </p>
          <Link
            href="/login"
            className="font-semibold rounded-xl inline-flex items-center justify-center w-full px-4 py-3 text-sm bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 shadow-sm transition-all duration-200"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageErrorBoundary>
    <div className="min-h-screen bg-gradient-to-br from-[var(--primary)] to-[var(--primary-700)] flex items-center justify-center px-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-[var(--sh2)] border border-[var(--border)] w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--primary-50)] rounded-xl mb-4">
            <BookOpen className="w-8 h-8 text-[var(--primary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--t1)]">
            Create Super Admin
          </h1>
          <p className="text-[var(--t3)] text-sm mt-1">
            Set up your admin account
          </p>
        </div>

        {error && (
          <div
            className="bg-[var(--red-soft)] text-[var(--error)] text-sm rounded-xl p-3 mb-4 border border-[var(--error)]/20"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-4">
          <Input
            label="Your Name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
          />
          <Input
            label="Phone Number (Login ID)"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            autoComplete="tel"
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
          >
            {loading ? "Creating..." : "Create Super Admin"}
          </Button>
        </form>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
