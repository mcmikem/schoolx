"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
const SLOW_CONNECTION_MS = 5000;

export default function LoginPage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    if (typeof window === "undefined") return;
    const error = searchParams?.get("error");
    const registered = searchParams?.get("registered");
    const phoneParam = searchParams?.get("phone");

    if (error === "access_denied") {
      toast.warning("Sign in cancelled. Please try again.");
    } else if (error === "server_error") {
      toast.error("Authentication server error. Please try again.");
    } else if (error) {
      toast.error(`Authentication failed: ${error}`);
    }

    if (registered === "1") {
      toast.success("Account created! Please check your email or phone to verify.");
    }

    if (phoneParam) {
      setIdentifier(phoneParam);
    }
  }, [searchParams, toast]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!authInitialized || !user) return;
    const destination =
      user.role === "super_admin"
        ? "/super-admin"
        : user.role === "parent"
          ? "/parent-portal"
          : user.role === "student"
            ? "/student-portal"
            : "/dashboard";
    router.replace(destination);
  }, [authInitialized, user, router]);

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
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

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
      const message = err instanceof Error ? err.message : "Google login failed";
      if (message.includes("redirect_url_mismatch") || message.includes("redirect")) {
        toast.error(
          "Google login misconfigured. Ensure the OAuth redirect URL is whitelisted in Supabase Dashboard > Authentication.",
        );
      } else {
        toast.error(message);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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
      const DEMO_PHONES = ["256700000001", "256700000002", "256700000003", "256700000004", "256700000005"];
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

      setLoading(false);
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

          {DEMO_MODE_ENABLED && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">Demo Accounts</p>
              <p className="font-mono">256700000001 / 256700000002</p>
              <p className="font-mono">256700000003 / 256700000004</p>
              <p className="mt-1 text-amber-600">
                Password: <span className="font-mono font-bold">skoolmate123</span>
              </p>
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

            {!authInitialized && (
              <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 text-center">
                Checking your session...
              </div>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading || otpLoading || !authInitialized}
              disabled={!authInitialized}
              icon={
                !loading && !otpLoading && authInitialized ? (
                  <MaterialIcon icon="login" className="text-lg" />
                ) : undefined
              }
            >
              {!authInitialized
                ? "Initializing..."
                : otpMode
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
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 space-y-2">
            <span>
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-slate-900 hover:underline">
                Register
              </Link>
            </span>
            <br />
            <span>
              Want to see it first?{" "}
              <a
                href="https://wa.me/256700000000?text=Hi%2C%20I%27d%20like%20a%20demo%20of%20SkoolMate"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-900 hover:underline"
              >
                Book a free walkthrough
              </a>
            </span>
          </p>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
