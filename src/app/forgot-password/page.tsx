"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import Link from "next/link";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { Button, Input } from "@/components/ui";
import { normalizeAuthPhone } from "@/lib/validation";

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className || ""}`}>{icon}</span>
  );
}

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    const clean = normalizeAuthPhone(phone);
    if (!phone.trim()) {
      setPhoneError("Phone number is required");
      return;
    }
    if (clean.length < 10 || clean.length > 12) {
      setPhoneError("Please enter a valid Uganda phone number (e.g. 0700000000)");
      return;
    }

    setLoading(true);

    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      // Always show success to avoid phone enumeration
      setSubmitted(true);
    } catch {
      // Show success regardless to avoid phone enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-[var(--bg)] flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--navy-soft)] blur-[120px] rounded-full opacity-50" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--green-soft)] blur-[120px] rounded-full opacity-30" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-white shadow-xl mb-6 ring-1 ring-slate-100">
              <SkoolMateLogo size="md" />
            </div>
            <h2 className="text-3xl font-extrabold text-[var(--t1)] tracking-tight">
              Reset your password
            </h2>
            <p className="mt-2 text-[var(--t3)] font-medium">
              We&apos;ll send reset instructions via WhatsApp or SMS
            </p>
          </div>

          <div className="card-premium p-8 md:p-10 shadow-[0_32px_64px_rgba(15,23,42,0.1)]">
            {submitted ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[var(--green-soft)] flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="check_circle" className="text-[36px] text-[var(--green)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--t1)]">Check your phone</h3>
                <p className="mt-2 text-sm text-[var(--t2)] leading-6">
                  If that number is registered, you&apos;ll receive a password reset message shortly. Contact your school admin or WhatsApp us at{" "}
                  <a
                    href="https://wa.me/256700000000"
                    className="font-semibold text-[var(--primary)] hover:text-[var(--green)] transition-colors"
                  >
                    +256 700 000 000
                  </a>{" "}
                  if you don&apos;t receive it.
                </p>
                <div className="mt-6">
                  <Link
                    href="/login"
                    className="btn btn-primary w-full justify-center"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Phone number (your login ID)"
                  id="phone"
                  type="tel"
                  placeholder="0700000000"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError("");
                  }}
                  error={phoneError}
                  required
                  autoComplete="tel"
                />

                <p className="text-xs text-[var(--t3)] leading-5">
                  Enter the phone number you used to register. We&apos;ll send a temporary password reset link via SMS or WhatsApp.
                </p>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  icon={!loading ? <MaterialIcon icon="send" className="text-lg" /> : undefined}
                >
                  {loading ? "Sending..." : "Send reset instructions"}
                </Button>
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--t3)]">
              Remembered your password?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--primary)] hover:text-[var(--green)] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
