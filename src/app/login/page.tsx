"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import AuthShell from "@/components/auth/AuthShell";
import { Button, Input } from "@/components/ui";
import { t, tWithParams } from "@/i18n";
import { useAuth } from "@/lib/auth-context";

const DEMO_KEY = "skoolmate_demo_v1";

function serializeDemoData(data: object): string {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

export default function LoginPage() {
  const toast = useToast();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const validatePhone = (value: string): boolean => {
    const clean = value.replace(/[^0-9]/g, "");
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
      setPhoneError("Use a valid school phone number, e.g. 0700000000");
      return;
    }

    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    setLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    localStorage.removeItem(DEMO_KEY);

    try {
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
    { role: "Head teacher", phone: "0700000001" },
    { role: "Teacher", phone: "0700000002" },
    { role: "Bursar", phone: "0700000003" },
    { role: "Dean", phone: "0700000004" },
  ];

  const handleDemoClick = (demoPhone: string) => {
    setPhone(demoPhone);
    setPassword(`demo${demoPhone.slice(-4)}`);
    setPhoneError("");
  };

  return (
    <AuthShell
      badge="Built for Ugandan schools"
      title="A calmer sign-in for busy school teams."
      description="Use the same visual language as the landing page, with large tap targets, simple phone-first fields, and clear demo access for staff testing on mobile."
      quickFacts={[
        "Phone-first login for shared devices",
        "Fast enough for weak networks",
        "Same look and feel as the public site",
      ]}
      highlights={[
        {
          icon: "wifi_off",
          title: "Low-bandwidth friendly",
          description:
            "Short forms and clear feedback help staff complete sign-in quickly when connectivity is unstable.",
        },
        {
          icon: "smartphone",
          title: "Comfortable on phones",
          description:
            "Large controls and simple labels reduce mistakes for staff working on smaller Android screens.",
        },
        {
          icon: "verified",
          title: "Trusted local workflow",
          description:
            "School admins, teachers, and bursars can use one familiar entry point instead of jumping between mismatched pages.",
        },
        {
          icon: "group_add",
          title: "Easy first demo",
          description:
            "Try role-based demo accounts without typing long credentials during onboarding or field visits.",
        },
      ]}
      contentTitle="Sign in to SkoolMate OS"
      contentDescription="Enter the phone number used by your school account. If you are just exploring, choose a demo role below."
      supportNote={
        <div className="space-y-2">
          <p className="font-semibold text-slate-800">
            Need a different access route?
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/parent/login"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <MaterialIcon icon="family_restroom" size={16} />
              Parent portal
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <MaterialIcon icon="how_to_reg" size={16} />
              Register a school
            </Link>
          </div>
        </div>
      }
      footer={
        <p className="text-center text-sm text-slate-500">
          {t("auth.noAccount")}{" "}
          <Link
            href="/register"
            className="font-semibold text-[#17325F] transition hover:text-[#2E9448]"
          >
            {t("auth.registerSchool")}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3">
          {[
            "Use your school phone number",
            "Passwords stay hidden by default",
            "Demo roles help with training",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <MaterialIcon
                icon="check_circle"
                className="mt-0.5 text-[#2E9448]"
                size={18}
              />
              <p className="text-sm leading-6 text-slate-600">{item}</p>
            </div>
          ))}
        </div>

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
          inputMode="numeric"
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
              onClick={() => setShowPassword((current) => !current)}
              className="rounded-lg p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              <MaterialIcon
                icon={showPassword ? "visibility_off" : "visibility"}
                size={18}
              />
            </button>
          }
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full rounded-2xl py-3 text-base"
          loading={loading}
          icon={!loading ? <MaterialIcon icon="login" size={18} /> : undefined}
        >
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </Button>

        <div className="relative pt-2">
          <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
          <div className="relative mx-auto w-fit bg-white px-3 text-sm text-slate-500">
            Try a demo role
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {demoAccounts.map((demo) => (
            <Button
              key={demo.phone}
              type="button"
              variant="secondary"
              className="min-h-12 w-full rounded-2xl justify-center px-3 text-left"
              onClick={() => handleDemoClick(demo.phone)}
            >
              <span className="block text-sm font-semibold">{demo.role}</span>
            </Button>
          ))}
        </div>
      </form>
    </AuthShell>
  );
}
