// ============================================================================
// 🔒 LOCKED DOWN — LOGIN PAGE (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Critical user-facing login flow. Changes can break password login, OTP login,
// Google OAuth, demo mode, rate limiting, and redirect logic.
//
// Last audited: 2026-05-12 | Bugs fixed: 4
// Known pitfalls:
//   - Demo phone numbers MUST be 12 digits (256700000001 format)
//   - OTP verifyOtp must use { email, token, type: "magiclink" } NOT token_hash/email
//   - Google OAuth redirectTo must include /auth/callback?next= param
//   - Client-side rate limiting uses exponential backoff (30s → 5min max)
//   - All identifiers must be normalized (email lowercase, phone via normalizeAuthPhone)
//   - router.replace() not router.push() for post-login redirects
//   - Demo mode requires BOTH ENABLE_DEV_TEST_ROUTES and NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OwlMascot from "@/components/brand/OwlMascot";
import { t, tWithParams } from "@/i18n";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isValidEmail, normalizeAuthPhone } from "@/lib/validation";
import { logger } from "@/lib/logger";
import MaterialIcon from "@/components/MaterialIcon";

const DEMO_KEY = "skoolmate_demo_v1";
const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

function serializeDemoData(data: object): string {
  try {
    const json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return "";
  }
}

function getPostLoginDestination(role?: string | null): string {
  const redirectParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect")
      : null;

  if (redirectParam && redirectParam.startsWith("/")) {
    return redirectParam;
  }

  if (role === "super_admin") return "/super-admin";
  if (role === "parent") return "/parent-portal";
  return "/dashboard";
}

export default function LoginPage() {
  const toast = useToast();
  const router = useRouter();
  const { signIn, user, authInitialized } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("remember_session");
    setRememberSession(saved !== "false");
  }, []);

  // Reset google loading spinner if user navigates back from the OAuth tab
  useEffect(() => {
    if (!googleLoading) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Give the OAuth redirect a moment — if we're still on this page, reset the spinner
        setTimeout(() => setGoogleLoading(false), 1500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [googleLoading]);

  // Redirect already-logged-in users away from the login page.
  // Respect the ?redirect= param set by proxy.ts middleware so users
  // land on the page they originally tried to visit.
  useEffect(() => {
    if (authInitialized && user) {
      const dest = getPostLoginDestination(user.role);
      router.replace(dest);
    }
  }, [user, authInitialized, router]);

  // Fail-safe: if login succeeded but redirect hasn't happened in 8s, force it
  useEffect(() => {
    if (!loading || !authInitialized) return;
    const timer = setTimeout(() => {
      if (user) {
        const dest = getPostLoginDestination(user.role);
        router.replace(dest);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading, user, authInitialized, router]);

  // Deterministic UI recovery: if auth initialized but user is still null,
  // stop the spinner so the user can retry manually.
  useEffect(() => {
    if (!loading || !authInitialized || user) return;
    const timer = setTimeout(() => {
      setLoading(false);
      setShowSlowMessage(false);
    }, 9000);
    return () => clearTimeout(timer);
  }, [loading, authInitialized, user]);

  // Show helpful toasts when arriving from registration or session expiry
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      const prefilledPhone = params.get("phone");
      if (prefilledPhone) setPhone(prefilledPhone);
      toast.success("Account created! Sign in to continue to your dashboard.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("reason") === "session_expired") {
      toast.info("Your session expired. Please sign in again to continue.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    const errorParam = params.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        google_auth_failed: "Google sign-in failed. Please try again or use your phone/email.",
        no_profile: "Your account exists but profile data is missing. Contact support.",
        oauth_error: "Social sign-in failed. Please try again.",
      };
      toast.error(errorMessages[errorParam] || "Sign-in failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateIdentifier = (identifier: string): boolean => {
    const trimmed = identifier.trim();
    if (!trimmed) return false;
    if (trimmed.includes("@")) return isValidEmail(trimmed.toLowerCase());
    const clean = normalizeAuthPhone(trimmed);
    return clean.length >= 10 && clean.length <= 12;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? (() => {
              const redirectParam = new URLSearchParams(window.location.search).get("redirect");
              const next = redirectParam && redirectParam.startsWith("/")
                ? redirectParam
                : "/dashboard";
              return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
            })()
          : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
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
      if (error) throw error;
    } catch (err) {
      logger.error("Google sign-in error:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Please try again.",
      );
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    setPasswordError("");
    setShowSlowMessage(false);

    const rawIdentifier = phone.trim();
    const isEmailLogin = rawIdentifier.includes("@");

    if (!rawIdentifier) {
      setPhoneError("Phone number or email is required");
      return;
    }

    if (!validateIdentifier(rawIdentifier)) {
      setPhoneError("Please enter a valid phone number or email");
      return;
    }

    // OTP mode - verify OTP
    if (otpMode && otpSent) {
      if (isEmailLogin) {
        setPhoneError("OTP login currently supports phone numbers only");
        return;
      }

      if (!otp || otp.length !== 6) {
        setPasswordError("Enter the 6-digit OTP");
        return;
      }

      setLoading(true);
      const slowMsgTimeout = setTimeout(() => setShowSlowMessage(true), 4000);
      localStorage.removeItem(DEMO_KEY);

      try {
        const res = await fetch("/api/auth/verify-otp/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizeAuthPhone(rawIdentifier), otp }),
        });
        const data = await res.json();

        if (data.success && data.token) {
          // Verify the magic link token to establish a Supabase session
          const { error: verifyError } = await supabase.auth.verifyOtp({
            email: data.email,
            token: data.token,
            type: "magiclink",
          });
          if (verifyError) {
            toast.error(verifyError.message || "OTP verification failed");
            setOtp("");
          }
          // Session is now created — onAuthStateChange will handle the rest
        } else {
          toast.error(data.error || "Invalid OTP");
          setOtp("");
        }
      } catch {
        toast.error("Login failed");
      } finally {
        clearTimeout(slowMsgTimeout);
        setShowSlowMessage(false);
        setLoading(false);
      }
      return;
    }

    // Password mode
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    // Client-side rate limiting
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const seconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${seconds}s`);
      return;
    }

    setLoading(true);

    // Show a friendly message after 5s so users on slow networks know
    // the app is still working and they should not refresh or re-tap.
    const slowMsgTimeout = setTimeout(() => {
      setShowSlowMessage(true);
    }, 4000);

    const normalizedIdentifier = isEmailLogin
      ? rawIdentifier.toLowerCase()
      : normalizeAuthPhone(rawIdentifier);

    if (typeof window !== "undefined") {
      localStorage.setItem("remember_session", rememberSession ? "true" : "false");
    }

    // Clear any previous demo data before login
    localStorage.removeItem(DEMO_KEY);

    // DEMO_PHONE_NUMBERS: only try demo login for known demo phone numbers
    // to avoid wasting a network round-trip for every real user
    const DEMO_PHONE_NUMBERS = ["256700000001", "256700000002", "256700000003", "256700000004", "256700000005"];
    const isDemoPhone = !isEmailLogin && DEMO_PHONE_NUMBERS.includes(normalizedIdentifier);

    try {
      if (DEMO_MODE_ENABLED && isDemoPhone) {
        const demoResponse = await fetch("/api/demo-login/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedIdentifier, password }),
        });

        if (demoResponse.ok) {
          const demoData = await demoResponse.json();
          if (demoData.success && demoData.demo) {
            const encoded = serializeDemoData({
              demoUser: demoData.user,
              demoSchool: demoData.school,
            });
            sessionStorage.setItem(DEMO_KEY, encoded);
            localStorage.removeItem(DEMO_KEY);
            document.cookie = `${DEMO_KEY}=${encoded}; path=/; max-age=86400`;
            toast.success(
              tWithParams("auth.welcomeDemo", { name: demoData.user.name }),
            );

            const redirectPath =
              demoData.user.role === "super_admin"
                ? "/super-admin"
                : demoData.user.role === "parent"
                  ? "/parent-portal"
                  : "/dashboard";

            router.replace(redirectPath);
            clearTimeout(slowMsgTimeout);
            return;
          }
        } else {
          const errorData = await demoResponse.json().catch(() => null);
          toast.error(errorData?.error || "Demo login failed. Check DEMO_ADMIN_PASSWORD in .env.local");
          clearTimeout(slowMsgTimeout);
          setLoading(false);
          setShowSlowMessage(false);
          return;
        }
      }

      const { error: authError } = await signIn(normalizedIdentifier, password);
      if (authError) {
        clearTimeout(slowMsgTimeout);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        const rawMsg =
          typeof authError === "string"
            ? authError
            : authError?.message || "";
        const msgLower = rawMsg.toLowerCase();
        const isRateLimit =
          msgLower.includes("rate limit") ||
          msgLower.includes("too many requests") ||
          msgLower.includes("request has expired");
        const isNetwork =
          msgLower.includes("network") || msgLower.includes("fetch") ||
          msgLower.includes("timed out") || msgLower.includes("timeout") ||
          msgLower.includes("abort") || msgLower.includes("lock") ||
          msgLower.includes("failed to fetch") || msgLower.includes("networkerror") ||
          msgLower.includes("login already in progress");
        const isProfileOrDbIssue =
          msgLower.includes("profile") ||
          msgLower.includes("database") ||
          msgLower.includes("server configuration") ||
          msgLower.includes("token") ||
          msgLower.includes("server error");

        if (newAttempts >= 5) {
          const lockDuration = Math.min(
            30_000 * Math.pow(2, newAttempts - 5),
            300_000,
          );
          setLockoutUntil(Date.now() + lockDuration);
          toast.error(
            `Too many failed attempts. Locked for ${Math.ceil(lockDuration / 1000)}s`,
          );
        } else if (isRateLimit) {
          toast.error(
            "Too many login attempts. Please wait a moment and try again.",
          );
        } else if (isNetwork) {
          const isLockInProgress = msgLower.includes("login already in progress");
          toast.error(
            isLockInProgress
              ? "Please wait — your previous login is still processing. Try again in a few seconds."
              : "Connection error. Please check your internet and try again.",
          );
        } else if (isProfileOrDbIssue) {
          toast.error(
            "Your account exists, but your profile could not be loaded. Please contact support.",
          );
        } else if (msgLower.includes("email not confirmed")) {
          toast.error(
            "Your account is not confirmed. Please contact school administration.",
          );
        } else {
          toast.error("Invalid login details");
        }
        setShowSlowMessage(false);
        setLoading(false);
        return;
      }
      setFailedAttempts(0);
      setLockoutUntil(null);
      // Fallback: if auth context hydration is delayed, probe for session and
      // redirect directly to avoid indefinite "Signing in..." states.
      const probeStartedAt = Date.now();
      while (Date.now() - probeStartedAt < 12000) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          clearTimeout(slowMsgTimeout);
          const role =
            typeof session.user.user_metadata?.role === "string"
              ? session.user.user_metadata.role
              : null;
          router.replace(getPostLoginDestination(role));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      clearTimeout(slowMsgTimeout);
      setShowSlowMessage(false);
      setLoading(false);
      toast.error("Sign-in is taking too long. Please try once more.");
      return;
    } catch (err: unknown) {
      clearTimeout(slowMsgTimeout);
      logger.error("Login exception:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
      setShowSlowMessage(false);
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: "Headmaster", phone: "0700000001" },
    { role: "Teacher", phone: "0700000002" },
    { role: "Bursar", phone: "0700000003" },
    { role: "Dean", phone: "0700000004" },
    { role: "Parent", phone: "0700000005" },
  ];

  const handleDemoClick = (demoPhone: string) => {
    setPhone(demoPhone);
    setPassword("skoolmate_demo_2024");
  };

  return (
    <PageErrorBoundary>
    <div className="min-h-screen bg-[linear-gradient(145deg,#f0f5fc_0%,#e8f0fb_40%,#f4f8ff_100%)] flex relative overflow-hidden">
      <div className="flex-1 flex flex-col justify-center relative z-10 w-full lg:max-w-[45%] xl:max-w-[40%] px-6 lg:px-16 xl:px-24">
        <div className="absolute top-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full bg-[#bdd6ff] blur-[150px] opacity-30" />
        <div className="absolute bottom-0 left-[10%] h-[30%] w-[40%] rounded-full bg-[#dfeeda] blur-[120px] opacity-40" />

        <div className="w-full max-w-[420px] mx-auto">
          {/* Back to home */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--t3)] hover:text-[var(--primary)] transition-colors"
            >
              <MaterialIcon icon="arrow_back" className="text-[16px]" />
              Back to home
            </Link>
          </div>

          {/* Header — matches landing page style */}
          <div className="mb-7">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--navy)]/10 bg-[var(--navy-soft)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--navy)]">
                <MaterialIcon icon="school" className="text-sm" />
                SkoolMate sign in
              </div>
            </div>
            <h1 className="font-['Sora'] text-[30px] font-semibold tracking-[-0.03em] text-[#102341] mb-3">
              Welcome back
            </h1>
            <p className="text-[15px] leading-6 text-[#53657f] mb-5">
              Your school workspace, reports, fees, and messages are waiting.
            </p>
            {/* Trust icon badges */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: "verified", label: "NCDC Compliant" },
                { icon: "fact_check", label: "UNEB Ready" },
                { icon: "wifi_off", label: "Works Offline" },
                { icon: "security", label: "Data Protected" },
              ].map((badge) => (
                <div
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[var(--t2)] shadow-sm"
                >
                  <MaterialIcon icon={badge.icon} className="text-[14px] text-[var(--green)]" />
                  {badge.label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/60 bg-white/82 p-8 shadow-[0_32px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-10">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Input
                  label="Phone Number or Email"
                  id="phone"
                  type="text"
                  placeholder="0700000000 or you@school.com"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError("");
                  }}
                  error={phoneError}
                  required
                  autoComplete="username"
                />
              </div>

              {!otpMode ? (
                <Input
                  label={t("auth.password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  error={passwordError}
                  required
                  autoComplete="current-password"
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="rounded-lg p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <MaterialIcon
                        icon={showPassword ? "visibility_off" : "visibility"}
                        className="text-xl"
                      />
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {!otpSent ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      loading={otpLoading}
                      onClick={async () => {
                        if (!phone) {
                          setPhoneError("Phone number required");
                          return;
                        }
                        setOtpLoading(true);
                        try {
                          const res = await fetch("/api/auth/otp/", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ phone: phone.trim() }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setOtpSent(true);
                            toast.success("OTP sent to your phone");
                          } else {
                            toast.error(data.error || "Failed to send OTP");
                          }
                        } catch {
                          toast.error("Network error");
                        } finally {
                          setOtpLoading(false);
                        }
                      }}
                    >
                      Send OTP to Phone
                    </Button>
                  ) : (
                    <>
                      <Input
                        label="One-Time Password"
                        id="otp"
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        required
                        autoComplete="one-time-code"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full"
                        loading={loading}
                      >
                        {loading ? t("auth.signingIn") : "Verify & Login"}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-sm text-[var(--t3)] hover:text-[var(--primary)]"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                        }}
                      >
                        Change phone number
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-2">
                {!otpMode ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--primary)] hover:underline"
                    onClick={() => {
                      setOtpMode(true);
                      setPassword("");
                      setShowSlowMessage(false);
                    }}
                  >
                    Login with OTP instead
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-[var(--primary)] hover:underline"
                    onClick={() => {
                      setOtpMode(false);
                      setOtpSent(false);
                      setOtp("");
                      setShowSlowMessage(false);
                    }}
                  >
                    Login with password
                  </button>
                )}
              </div>

              {!otpMode && (
                <label className="flex items-center gap-2 text-sm text-[var(--t2)]">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => setRememberSession(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  Keep me signed in on this device
                </label>
              )}

              {!otpMode && (
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  icon={
                    !loading ? (
                      <MaterialIcon icon="login" className="text-lg" />
                    ) : undefined
                  }
                >
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              )}

              {!otpMode && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  loading={googleLoading}
                  onClick={handleGoogleSignIn}
                  icon={<MaterialIcon icon="account_circle" className="text-lg" />}
                >
                  Continue with Google
                </Button>
              )}

              {showSlowMessage && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
                  <MaterialIcon icon="wifi_tethering_error" className="text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Connection seems slow</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Please wait a moment. Do not refresh or tap again — your login is still processing.
                    </p>
                  </div>
                </div>
              )}

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--t3)] hover:text-[var(--primary)] transition-colors"
                >
                  Forgot your password?
                </Link>
              </div>

              {DEMO_MODE_ENABLED && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border)]" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-[var(--surface)] text-[var(--t3)]">
                        Try Demo Account
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {demoAccounts.map((demo) => (
                      <Button
                        key={demo.phone}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center text-xs py-2"
                        onClick={() => handleDemoClick(demo.phone)}
                      >
                        {demo.role}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--t3)]">
              {t("auth.noAccount")}{" "}
              <Link
                href="/register"
                className="font-semibold text-[var(--primary)] hover:text-[var(--green)] transition-colors"
              >
                {t("auth.registerSchool")}
              </Link>
            </p>
          </div>

          {/* Mobile trust signals — visible only on mobile where the right panel is hidden */}
          <div className="mt-6 lg:hidden flex flex-wrap justify-center gap-x-4 gap-y-2">
            {[
              { icon: "verified", label: "NCDC 2025 Compliant" },
              { icon: "fact_check", label: "UNEB Ready" },
              { icon: "wifi_off", label: "Works Offline" },
              { icon: "security", label: "Data Protected" },
            ].map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--t3)]"
              >
                <MaterialIcon icon={badge.icon} className="text-[14px] text-[var(--green)]" />
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[linear-gradient(145deg,#0b1c39_0%,#17325f_58%,#1a4b79_100%)] text-white p-12 xl:p-24 flex-col justify-between">
        <div className="absolute top-0 right-0 w-full h-full opacity-40">
          <div
            className="absolute top-[10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-400 blur-[120px] mix-blend-overlay animate-pulse"
            style={{ animationDuration: "8s" }}
          />
          <div
            className="absolute bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-teal-400 blur-[100px] mix-blend-overlay animate-pulse"
            style={{ animationDelay: "4s", animationDuration: "10s" }}
          />
        </div>

        <div className="relative z-10">
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-100">
              <MaterialIcon icon="verified" className="text-teal-300" style={{ fontSize: 18 }} />
              Built for Uganda schools
            </span>
          </div>
          <div className="mb-8">
            <OwlMascot size={94} premium ring glow animated />
          </div>
          <h1 className="text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight mb-6">
            The Operating System
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-blue-200">
              For Ugandan Schools.
            </span>
          </h1>
          <p className="text-lg xl:text-xl text-blue-100/80 font-medium max-w-lg leading-relaxed">
            The owl welcomes staff into a calmer, clearer workspace built for admissions, attendance, fees, report cards, and parent communication.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-4 max-w-md">
          {[
            {
              icon: "how_to_reg",
              title: "10-Second Attendance",
              desc: "Take class attendance faster than you can write on a chalkboard.",
            },
            {
              icon: "sms",
              title: "Instant Parent SMS",
              desc: "Keep parents informed with automatic fee reminders and holiday notices.",
            },
            {
              icon: "description",
              title: "Auto-Generated Reports",
              desc: "Stop calculating averages by hand. Click one button to print student report cards.",
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-4 rounded-[24px] border border-white/18 bg-white/10 p-5 shadow-[0_24px_48px_rgba(3,11,27,0.18)] backdrop-blur-xl">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <MaterialIcon
                  icon={item.icon}
                  className="text-teal-300 text-xl"
                />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">{item.title}</h3>
                <p className="text-xs text-blue-100/70 leading-relaxed mt-1">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
