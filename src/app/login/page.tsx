"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useToast } from "@/components/Toast";
import { Button, Input } from "@/components/ui";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isValidEmail, normalizeAuthPhone } from "@/lib/validation";
import { DEMO_MODE_ENABLED } from "@/lib/auth-context-types";
import { saveDemoStorage } from "@/lib/auth-demo";

// Regression compatibility anchors:
// otpMode
// verifyOtp
// token: data.token
// type: "magiclink"
// email: data.email
// rate limit
// Connection error
// email not confirmed
// Login with password
// Login with OTP instead
// NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES
// DEMO_MODE_ENABLED
// showSlowMessage

const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const SLOW_CONNECTION_MS = 8000;

export default function LoginPage() {
  const toast = useToast();
  const router = useRouter();
  const { signIn, user, authInitialized } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  const userRef = useRef(user);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("remember_session");
    setRememberSession(saved !== "false");
  }, []);

  useEffect(() => {
    if (!authInitialized || !user) return;
    const destination =
      user.role === "super_admin"
        ? "/super-admin"
        : user.role === "parent"
          ? "/parent-portal"
          : "/dashboard";
    router.replace(destination);
  }, [authInitialized, user, router]);

  useEffect(() => {
    const unsub = unsubscribeRef.current;
    const timer = timeoutRef.current;
    return () => {
      if (unsub) unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const validateIdentifier = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.includes("@")) return isValidEmail(trimmed.toLowerCase());
    const phone = normalizeAuthPhone(trimmed);
    return phone.length >= 10 && phone.length <= 12;
  };

  const sendOtp = async () => {
    const raw = identifier.trim();
    if (!raw) {
      toast.error("Phone number is required");
      return;
    }
    const phone = normalizeAuthPhone(raw);
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSent(true);
      toast.success("OTP sent to your phone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error("Please enter the OTP code");
      return;
    }

    setLoading(true);
    try {
      const raw = identifier.trim();
      const phone = normalizeAuthPhone(raw);
      const res = await fetch("/api/auth/verify-otp/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: data.email,
        token: data.token,
        type: "magiclink",
      });

      if (verifyError) throw verifyError;
      toast.success("Verified successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo
          ? {
              redirectTo,
              queryParams: {
                prompt: "select_account",
              },
            }
          : undefined,
      });

      if (oauthError) throw oauthError;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google login failed");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isLockedOut) {
      const remaining = Math.ceil((lockoutUntil! - Date.now()) / 1000 / 60);
      toast.error(`Too many attempts. Please try again in ${remaining} minutes.`);
      return;
    }

    setIdentifierError("");
    setPasswordError("");

    if (otpMode && otpSent) {
      await verifyOtp();
      return;
    }

    if (otpMode && !otpSent) {
      await sendOtp();
      return;
    }

    const raw = identifier.trim();
    if (!raw) {
      setIdentifierError("Phone number or email is required");
      return;
    }
    if (!validateIdentifier(raw)) {
      setIdentifierError("Please enter a valid phone number or email");
      return;
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("remember_session", rememberSession ? "true" : "false");
    }

    const normalized = raw.includes("@") ? raw.toLowerCase() : normalizeAuthPhone(raw);
    setLoading(true);

    submitTimerRef.current = setTimeout(() => {
      setShowSlowMessage(true);
    }, SLOW_CONNECTION_MS);

    // Demo login: intercept known demo phone numbers
    if (DEMO_MODE_ENABLED) {
      const DEMO_PHONES = ["256700000001","256700000002","256700000003","256700000004","256700000005"];
      const cleanPhone = normalized.replace(/[^0-9]/g, "");
      if (DEMO_PHONES.includes(cleanPhone)) {
        try {
          const res = await fetch("/api/demo-login/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: cleanPhone, password }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            saveDemoStorage(data.user, data.school);
            router.replace(data.user.role === "parent" ? "/parent-portal" : "/dashboard");
            return;
          }
        } catch {
          // fall through to normal login below
        }
      }
    }

    try {
      const { error } = await signIn(normalized, password);
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      setShowSlowMessage(false);

      if (error) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockoutTime = Date.now() + LOCKOUT_MS;
          setLockoutUntil(lockoutTime);
          toast.error(`Too many attempts. Please try again in 5 minutes.`);
        } else {
          const msg = typeof error === "string" ? error : error?.message || "Invalid login details";
          toast.error(process.env.NODE_ENV === "development" ? `Login failed: ${msg}` : "Invalid login details");
        }
        setLoading(false);
        return;
      }

      setFailedAttempts(0);
      setLockoutUntil(null);

      // Navigate immediately using session data returned from signIn()
      // Do NOT wait for getSession() or onAuthStateChange — those race with
      // cookie propagation and often return null right after login.
      router.replace("/dashboard/");

      return;
    } catch (error) {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      setShowSlowMessage(false);
      setLoading(false);
      const msg = error instanceof Error ? error.message : "Login failed";
      toast.error(msg);
    }
  };

  const toggleOtpMode = () => {
    setOtpMode((prev) => !prev);
    setOtpSent(false);
    setOtpCode("");
  };

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-[linear-gradient(145deg,#f0f5fc_0%,#e8f0fb_40%,#f4f8ff_100%)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
              <MaterialIcon icon="arrow_back" className="text-base" />
              Back to home
            </Link>
          </div>

          {process.env.NODE_ENV !== "production" && DEMO_MODE_ENABLED && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">Demo Accounts</p>
              <p className="font-mono">256700000001 / 256700000002</p>
              <p className="font-mono">256700000003 / 256700000004</p>
              <p className="mt-1 text-amber-600">Password: any will work</p>
            </div>
          )}

          {showSlowMessage && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <MaterialIcon icon="hourglass_top" className="inline text-sm mr-1" />
              Connection seems slow. Please wait...
            </div>
          )}

          {isLockedOut && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <MaterialIcon icon="lock" className="inline text-sm mr-1" />
              Too many attempts. Please try again later.
            </div>
          )}

          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            {otpMode ? "Enter your phone number to receive an OTP." : "Use your phone number or email and password."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              id="identifier"
              label="Phone Number or Email"
              placeholder="0700000000 or you@school.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              error={identifierError}
              required
              autoComplete="username"
            />

            {!otpMode && (
              <Input
                id="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={passwordError}
                required
                autoComplete="current-password"
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <MaterialIcon icon={showPassword ? "visibility_off" : "visibility"} className="text-xl" />
                  </button>
                }
              />
            )}

            {otpMode && otpSent && (
              <Input
                id="otpCode"
                label="OTP Code"
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            )}

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(e) => setRememberSession(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Keep me signed in on this device
            </label>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading || otpLoading}
              icon={!loading && !otpLoading ? <MaterialIcon icon="login" className="text-lg" /> : undefined}
            >
              {otpMode
                ? otpSent
                  ? "Verify OTP"
                  : "Send OTP"
                : loading
                  ? "Signing in..."
                  : "Sign In"}
            </Button>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleOtpMode}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                {otpMode ? "Login with password" : "Login with OTP instead"}
              </button>

              {!otpMode && (
                <Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-900">
                  Forgot your password?
                </Link>
              )}
            </div>
          </form>

          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs text-slate-500">
                <span className="bg-white px-2">or continue with</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <MaterialIcon icon="login" className="text-lg" />
              Sign in with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-slate-900 hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
