"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";
import { t, tWithParams } from "@/i18n";
import { Button, Input } from "@/components/ui";

const DEMO_KEY = "omuto_demo_v1";

// WARNING: This is a DEMO-ONLY password for local testing.
// Never use this value in production. Remove or gate demo mode behind a feature flag.
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo1234";

function encryptDemoData(data: object): string {
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
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    {
      role: "Headmaster",
      phone: "0700000001",
      password: DEMO_PASSWORD,
      label: "Headmaster",
    },
    {
      role: "Parent",
      phone: "0700000005",
      password: DEMO_PASSWORD,
      label: "Parent Portal",
    },
    {
      role: "Teacher",
      phone: "0700000002",
      password: DEMO_PASSWORD,
      label: "Teacher",
    },
    {
      role: "Bursar",
      phone: "0700000003",
      password: DEMO_PASSWORD,
      label: "Bursar",
    },
  ];

  const handleDemoLogin = (demo: (typeof demoAccounts)[0]) => {
    setPhone(demo.phone);
    setPassword(demo.password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || !password.trim()) {
      toast.error(t("auth.validationRequired"));
      return;
    }

    setLoading(true);

    const demoUsers: Record<
      string,
      { role: string; name: string; school_id: string }
    > = {
      "0700000001": {
        role: "headmaster",
        name: "John Headmaster",
        school_id: "demo-school",
      },
      "0700000002": {
        role: "teacher",
        name: "Mary Teacher",
        school_id: "demo-school",
      },
      "0700000003": {
        role: "bursar",
        name: "James Bursar",
        school_id: "demo-school",
      },
      "0700000004": {
        role: "dean_of_studies",
        name: "Sarah Dean",
        school_id: "demo-school",
      },
      "0700000005": {
        role: "parent",
        name: "Robert Parent",
        school_id: "demo-school",
      },
    };

    const cleanPhone = phone.replace(/[^0-9]/g, "");

    // Clear any previous demo data before login
    localStorage.removeItem(DEMO_KEY);

    // DEMO LOGIN - always use local demo mode
    if (password === DEMO_PASSWORD && demoUsers[cleanPhone]) {
      const demoUser = demoUsers[cleanPhone];
      const demoSchoolData = {
        id: "00000000-0000-0000-0000-000000000001",
        name: "St. Mary's Primary School (Demo)",
        school_code: "DEMO001",
        district: "Kampala",
        school_type: "primary",
        ownership: "private",
        primary_color: "#17325F",
        subscription_plan: "premium",
        subscription_status: "active",
      };
      const demoData = encryptDemoData({
        demoUser,
        demoSchool: demoSchoolData,
      });
      localStorage.setItem(DEMO_KEY, demoData);
      toast.success(tWithParams("auth.welcomeDemo", { name: demoUser.name }));

      const redirectPath =
        demoUser.role === "super_admin"
          ? "/super-admin"
          : demoUser.role === "parent"
            ? "/parent-portal"
            : "/dashboard";

      window.location.href = redirectPath;
      return;
    }

    // Normal login - Supabase auth
    try {
      if (!supabase) {
        toast.error(
          "Supabase not configured. Please check environment variables.",
        );
        setLoading(false);
        return;
      }

      const email = `${cleanPhone}@omuto.sms`;

      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        },
      );

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

      if (!data.user) {
        toast.error("Login failed - no user found");
        setLoading(false);
        return;
      }

      toast.success("Login successful!");

      // Wait a moment for auth to settle, then redirect
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    } catch (err: unknown) {
      console.error("Login exception:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex relative overflow-hidden">
      {/* Left Column: Login Form */}
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
              <Input
                label={t("auth.phoneNumber")}
                id="phone"
                type="tel"
                placeholder={t("auth.phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />

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
                    {t("auth.demoAccounts")}
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
                    onClick={() => handleDemoLogin(demo)}
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

      {/* Right Column: Dynamic Branding & Social Proof */}
      <div className="hidden lg:flex flex-1 relative bg-[var(--primary)] text-white overflow-hidden p-12 xl:p-24 flex-col justify-between">
        {/* Dynamic Glass/Liquid Background Effects */}
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
              Trusted by 500+ Schools
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

        {/* Testimonial Card */}
        <div className="relative z-10 max-w-md">
          <div className="p-8 rounded-[32px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl relative">
            <MaterialIcon
              icon="format_quote"
              className="absolute top-6 right-8 text-5xl text-white/10"
            />
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <MaterialIcon
                  key={i}
                  icon="star"
                  className="text-amber-400 text-sm"
                />
              ))}
            </div>
            <p className="text-lg font-medium leading-relaxed mb-6 italic text-white/90">
              &quot;SkoolMate transformed how we operate. We collected 40% more
              fees on time and our parents love the real-time academic updates
              via the portal.&quot;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center font-bold border-2 border-white/20 shadow-lg">
                SO
              </div>
              <div>
                <p className="font-bold text-base">Sarah Otim</p>
                <p className="text-xs text-blue-200 font-medium tracking-wide uppercase">
                  Director, Hillside College
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
