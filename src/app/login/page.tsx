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
  children,
}: {
  icon: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={`material-symbols-outlined ${className || ""}`}>
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
      
      const redirectPath = demoUser.role === "super_admin" 
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
    <div className="min-h-screen bg-[var(--bg)] flex flex-col justify-center relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--navy-soft)] blur-[120px] rounded-full opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--green-soft)] blur-[120px] rounded-full opacity-30" />
      
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-white shadow-xl mb-6 ring-1 ring-slate-100">
             <AnimatedLogo type="logo" className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--t1)] tracking-tight">
             Welcome Back
          </h2>
          <p className="mt-2 text-[var(--t3)] font-medium">
             Enter your credentials to access your workspace
          </p>
        </div>

        <div className="card-premium p-8 md:p-10 shadow-[0_32px_64px_rgba(15,23,42,0.1)]">
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
    </div>
  );
}
