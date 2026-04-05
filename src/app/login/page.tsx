"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import OmutoLogo from "@/components/OmutoLogo";
import { t, tWithParams } from "@/i18n";

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
      role: "Super Admin",
      phone: "0700000000",
      password: DEMO_PASSWORD,
      label: "Super Admin (System)",
    },
    {
      role: "Headmaster",
      phone: "0700000001",
      password: DEMO_PASSWORD,
      label: "Headmaster (Full Access)",
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
      label: "Bursar (Fees Only)",
    },
    {
      role: "Dean",
      phone: "0700000004",
      password: DEMO_PASSWORD,
      label: "Dean of Studies",
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
      "0700000000": {
        role: "super_admin",
        name: "Super Admin",
        school_id: "system-admin",
      },
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
      // Use window.location for a full page reload to ensure auth context picks up the new demo data
      window.location.href = "/dashboard";
      return;
    }

    // Normal login - Supabase auth
    try {
      if (!supabase) {
        toast.error("Supabase not configured. Please check environment variables.");
        setLoading(false);
        return;
      }

      const email = `${cleanPhone}@omuto.sms`;
      console.log("Attempting login with:", email);

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

      console.log("Login success, user:", data.user.id);
      toast.success("Login successful!");
      router.push("/dashboard");
      router.refresh();
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
    <div className="min-h-screen bg-[#f8fafb] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <OmutoLogo size="lg" />
        </div>

        <h2 className="mt-6 text-center text-2xl font-bold text-[#002045]">
          {t("auth.signInToAccount")}
        </h2>
        <p className="mt-2 text-center text-sm text-[#5c6670]">
          {t("auth.enterPhoneAndPassword")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl border border-[#e8eaed] py-8 px-6 sm:px-10 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="phone"
                className="text-sm font-medium text-[#191c1d] mb-2 block"
              >
                {t("auth.phoneNumber")}
              </label>
              <input
                id="phone"
                type="tel"
                placeholder={t("auth.phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#191c1d] mb-2 block"
              >
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c6670] hover:text-[#002045]"
                >
                  <MaterialIcon
                    icon={showPassword ? "visibility_off" : "visibility"}
                    className="text-xl"
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <MaterialIcon
                    icon="progress_activity"
                    className="animate-spin"
                  />
                  {t("auth.signingIn")}
                </span>
              ) : (
                <>
                  <MaterialIcon icon="login" className="text-lg" />
                  {t("auth.signIn")}
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e8eaed]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-[#5c6670]">
                  {t("auth.demoAccounts")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.phone}
                  type="button"
                  onClick={() => handleDemoLogin(demo)}
                  className="btn btn-secondary text-xs py-2"
                >
                  {demo.role}
                </button>
              ))}
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#5c6670]">
              {t("auth.noAccount")}{" "}
              <Link
                href="/register"
                className="font-semibold text-[#002045] hover:text-[#006e1c]"
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
