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
import { normalizeAuthPhone } from "@/lib/validation";

const DEMO_KEY = "skoolmate_demo_v1";
const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

function serializeDemoData(data: object): string {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

function MaterialIcon({
  icon,
  className,
  style,
  children,
}: {
  icon: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className || ""}`}
      style={style}
    >
      {icon || children}
    </span>
  );
}

export default function LoginPage() {
  const toast = useToast();
  const router = useRouter();
  const { signIn, user, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Redirect already-logged-in users away from the login page
  useEffect(() => {
    if (!authLoading && user) {
      const dest =
        user.role === "super_admin" ? "/super-admin"
        : user.role === "parent" ? "/parent-portal"
        : "/dashboard";
      router.replace(dest);
    }
  }, [user, authLoading, router]);

  // Show a helpful toast when arriving from registration
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      const prefilledPhone = params.get("phone");
      if (prefilledPhone) setPhone(prefilledPhone);
      toast.success("Account created! Sign in to continue to your dashboard.");
      // Clean the URL so refresh doesn't re-toast
      window.history.replaceState({}, "", "/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePhone = (phone: string): boolean => {
    const clean = normalizeAuthPhone(phone);
    return clean.length >= 10 && clean.length <= 12;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    setPasswordError("");

    if (!phone.trim()) {
      setPhoneError("Phone number is required");
      return;
    }

    if (!validatePhone(phone)) {
      setPhoneError("Please enter a valid phone number");
      return;
    }

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

    const cleanPhone = normalizeAuthPhone(phone);

    // Clear any previous demo data before login
    localStorage.removeItem(DEMO_KEY);

    try {
      if (DEMO_MODE_ENABLED) {
        const demoResponse = await fetch("/api/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: cleanPhone, password }),
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
            return;
          }
        }
      }

      const { error: authError, role } = await signIn(cleanPhone, password);
      if (authError) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
          const lockDuration = Math.min(30_000 * Math.pow(2, newAttempts - 5), 300_000);
          setLockoutUntil(Date.now() + lockDuration);
          toast.error(`Too many failed attempts. Locked for ${Math.ceil(lockDuration / 1000)}s`);
        } else {
          toast.error("Invalid phone number or password");
        }
        setLoading(false);
        return;
      }
      setFailedAttempts(0);
      setLockoutUntil(null);

      // setLoading(false) so React re-renders; the useEffect below will then
      // call router.replace() after the render — this is more reliable than
      // calling router.replace() from inside an async handler after an await.
      setLoading(false);
      return;
    } catch (err: unknown) {
      console.error("Login exception:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: "Headmaster", phone: "0700000001" },
    { role: "Teacher", phone: "0700000002" },
    { role: "Bursar", phone: "0700000003" },
    { role: "Dean", phone: "0700000004" },
  ];

  const handleDemoClick = (demoPhone: string) => {
    setPhone(demoPhone);
    // Use last 4 digits of demo phone to make demo password unique
    const demoPass = "demo" + demoPhone.slice(-4);
    setPassword(demoPass);
  };

  return (
    <PageErrorBoundary>
    {/* Guard: if user is known (just logged in or already authenticated),
        show a plain spinner so there's no flash of the form while router
        is processing the redirect from the useEffect below. */}
    {(authLoading || user) ? (
      <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-[#001F3F] border-t-transparent rounded-full animate-spin" />
      </div>
    ) : (
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
                  label={t("auth.phoneNumber")}
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
              </div>

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
    )}
    </PageErrorBoundary>
  );
}
