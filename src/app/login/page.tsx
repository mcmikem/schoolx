"use client";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";
import { t, tWithParams } from "@/i18n";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

const DEMO_KEY = "skoolmate_demo_v1";

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
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const validatePhone = (phone: string): boolean => {
    const clean = phone.replace(/[^0-9]/g, "");
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

    setLoading(true);

    const cleanPhone = phone.replace(/[^0-9]/g, "");

    // Clear any previous demo data before login
    localStorage.removeItem(DEMO_KEY);

    try {
      // Try server-side demo login first
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

      const { error: authError } = await signIn(cleanPhone, password);
      if (authError) {
        console.error("Auth error:", authError);
        if (authError.message.includes("Invalid login credentials")) {
          toast.error("Invalid phone number or password");
        } else {
          toast.error(authError.message);
        }
        setLoading(false);
        return;
      }

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
    <div className="min-h-screen bg-[var(--bg)] flex relative overflow-hidden">
      <div className="flex-1 flex flex-col justify-center relative z-10 w-full lg:max-w-[45%] xl:max-w-[40%] px-6 lg:px-16 xl:px-24">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[var(--primary)] blur-[150px] rounded-full opacity-10" />

        <div className="w-full max-w-[420px] mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white shadow-lg mb-6 ring-1 ring-slate-100">
              <AnimatedLogo type="logo" className="w-10 h-10" />
            </div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">
              Welcome Back
            </h2>
            <p className="mt-2 text-slate-500 font-medium">
              Enter your credentials to access your digital campus.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-8 md:p-10 shadow-[0_32px_64px_rgba(15,23,42,0.06)] rounded-[32px] border border-white/50">
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

      <div className="hidden lg:flex flex-1 relative bg-[var(--primary)] text-white overflow-hidden p-12 xl:p-24 flex-col justify-between">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8">
            <MaterialIcon
              icon="verified"
              className="text-teal-300"
              style={{ fontSize: 18 }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-100">
              Locally Optimized for Uganda
            </span>
          </div>
          <h1 className="text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight mb-6">
            The Operating System
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-blue-200">
              For African Education.
            </span>
          </h1>
          <p className="text-lg xl:text-xl text-blue-100/80 font-medium max-w-lg leading-relaxed">
            Eliminate paperwork, track fees in real-time, keep parents engaged,
            and run your entire campus from a single premium dashboard.
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
            <div
              key={i}
              className="p-5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl flex gap-4"
            >
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
  );
}
