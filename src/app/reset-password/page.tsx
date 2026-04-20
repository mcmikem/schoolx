"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button, Input } from "@/components/ui";

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className || ""}`}>{icon}</span>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Supabase sends the recovery token in the URL hash.
    // onAuthStateChange fires PASSWORD_RECOVERY when the hash is present.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If the page is loaded without a recovery hash (direct navigation),
    // mark as expired so the user gets a helpful message.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.includes("type=recovery") && !hash.includes("access_token")) {
      // Give the listener a moment to fire before declaring expired
      const timer = setTimeout(() => {
        setExpired(true);
      }, 1200);
      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError("Password must contain at least one uppercase letter and one number");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setPasswordError(error.message || "Failed to update password. Your link may have expired.");
      return;
    }

    // Sign out after reset so user logs in fresh with new password
    await supabase.auth.signOut();
    setDone(true);
  };

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-[var(--bg)] flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--navy-soft)] blur-[120px] rounded-full opacity-50" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--green-soft)] blur-[120px] rounded-full opacity-30" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4">
          <div className="mb-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--t3)] hover:text-[var(--primary)] transition-colors"
            >
              <MaterialIcon icon="arrow_back" className="text-[16px]" />
              Back to sign in
            </Link>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--navy)]/10 bg-[var(--navy-soft)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--navy)] mb-4">
              <MaterialIcon icon="lock_reset" className="text-sm" />
              Reset password
            </div>
            <h1 className="font-['Sora'] text-[30px] font-semibold tracking-[-0.03em] text-[#102341] mb-2">
              Set a new password
            </h1>
            <p className="text-[15px] leading-6 text-[#53657f]">
              Choose a strong password for your SkoolMate account.
            </p>
          </div>

          <div className="card-premium p-8 md:p-10 shadow-[0_32px_64px_rgba(15,23,42,0.1)]">
            {done ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[var(--green-soft)] flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="check_circle" className="text-[36px] text-[var(--green)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--t1)]">Password updated!</h3>
                <p className="mt-2 text-sm text-[var(--t2)] leading-6">
                  Your password has been changed. Sign in with your phone number and new password.
                </p>
                <div className="mt-6">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => router.push("/login")}
                  >
                    Go to sign in
                  </Button>
                </div>
              </div>
            ) : expired ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[var(--red-soft,#fff0f0)] flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="link_off" className="text-[36px] text-[var(--error,#dc2626)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--t1)]">Link expired or invalid</h3>
                <p className="mt-2 text-sm text-[var(--t2)] leading-6">
                  Password reset links expire after 1 hour. Request a new one from the forgot-password page.
                </p>
                <div className="mt-6">
                  <Link href="/forgot-password" className="btn btn-primary w-full justify-center">
                    Request new link
                  </Link>
                </div>
              </div>
            ) : !ready ? (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="w-8 h-8 border-[3px] border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--t3)]">Verifying reset link…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="New password"
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <Input
                  label="Confirm new password"
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  error={passwordError}
                  required
                  autoComplete="new-password"
                />
                <ul className="text-xs text-[var(--t3)] space-y-1 list-inside">
                  <li className={`flex items-center gap-1.5 ${password.length >= 8 ? "text-[var(--green)]" : ""}`}>
                    <MaterialIcon icon={password.length >= 8 ? "check_circle" : "radio_button_unchecked"} className="text-[14px]" />
                    At least 8 characters
                  </li>
                  <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(password) ? "text-[var(--green)]" : ""}`}>
                    <MaterialIcon icon={/[A-Z]/.test(password) ? "check_circle" : "radio_button_unchecked"} className="text-[14px]" />
                    One uppercase letter
                  </li>
                  <li className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? "text-[var(--green)]" : ""}`}>
                    <MaterialIcon icon={/[0-9]/.test(password) ? "check_circle" : "radio_button_unchecked"} className="text-[14px]" />
                    One number
                  </li>
                </ul>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  icon={!loading ? <MaterialIcon icon="lock_reset" className="text-lg" /> : undefined}
                >
                  {loading ? "Updating password…" : "Update password"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
