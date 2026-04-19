"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";
import OwlStage from "@/components/brand/OwlStage";
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
  const { signIn, user, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "super_admin") {
        window.location.href = "/super-admin";
      } else if (user.role === "parent") {
        window.location.href = "/parent-portal";
      } else {
        window.location.href = "/dashboard";
      }
    }
  }, [user, authLoading]);

  // Show a spinner while auth state is initializing to prevent flash
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#edf4ff_0%,#f7f4ec_55%,#f4efe4_100%)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <OwlStage
            align="center"
            eyebrow="Preparing your workspace"
            title="The owl is opening SkoolMate"
            description="Checking your school session, restoring your dashboard state, and preparing a smooth sign-in."
            chips={["Secure sign-in", "Fast parent follow-up", "Ready for daily operations"]}
          />
        </div>
      </div>
    );
  }

  const validatePhone = (phone: string): boolean => {
    const clean = normalizeAuthPhone(phone);
    return clean.length >= 10 && clean.length <= 12;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    if (!phone.trim()) {
      setPhoneError("Phone number is required");
      return;
    }

    if (!validatePhone(phone)) {
      setPhoneError("Please enter a valid phone number");
      return;
    }

    if (!password.trim()) {
      toast.error("Password is required");
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

            window.location.href = redirectPath;
            return;
          }
        }
      }

      const { error: authError } = await signIn(cleanPhone, password);
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

      toast.success("Login successful!");
    } catch (err: unknown) {
      console.error("Login exception:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff5ff_0%,#f7f5ee_52%,#f1ebdf_100%)] flex relative overflow-hidden">
      <div className="flex-1 flex flex-col justify-center relative z-10 w-full lg:max-w-[45%] xl:max-w-[40%] px-6 lg:px-16 xl:px-24">
        <div className="absolute top-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full bg-[#bdd6ff] blur-[150px] opacity-30" />
        <div className="absolute bottom-0 left-[10%] h-[30%] w-[40%] rounded-full bg-[#dfeeda] blur-[120px] opacity-40" />

        <div className="w-full max-w-[420px] mx-auto">
          <div className="mb-7">
            <OwlStage
              compact
              eyebrow="SkoolMate sign in"
              title="Welcome back"
              description="Your school workspace, reports, fees, and messages are waiting. Sign in and continue where the team left off."
              chips={["Trusted by daily admin teams", "Built for real school operations"]}
            />
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
                onChange={(e) => setPassword(e.target.value)}
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
          <div className="mb-8 flex items-center gap-4">
            <div className="inline-flex items-center justify-center rounded-[24px] border border-white/12 bg-white/8 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.16)] backdrop-blur-md">
              <AnimatedLogo type="logo_white" className="h-10 w-28" />
            </div>
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
              For African Education.
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
