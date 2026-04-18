"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { logger } from "@/lib/logger";
import { Button, Input, Select } from "@/components/ui";
import {
  getDistrictOptions,
  getParishOptions,
  getSubcountyOptions,
} from "@/lib/uganda-admin";
import { normalizeAuthPhone } from "@/lib/validation";

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

const SCHOOL_TYPE_OPTIONS = [
  { value: "primary", label: "Primary School" },
  { value: "secondary", label: "Secondary School" },
  { value: "combined", label: "Combined (Primary and Secondary)" },
];

const OWNERSHIP_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "government", label: "Government" },
  { value: "government_aided", label: "Government Aided" },
];

const DISTRICT_OPTIONS = [
  { value: "", label: "Select district" },
  ...getDistrictOptions(),
];

const PACKAGE_OPTIONS = [
  { value: "starter", label: "Starter Trial · best for one campus getting started" },
  { value: "growth", label: "Growth Trial · adds parent portal and richer workflows" },
  { value: "enterprise", label: "Enterprise Trial · full school operations suite" },
  { value: "lifetime", label: "Lifetime Setup Call · for schools ready for full rollout" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    schoolName: "",
    district: "",
    subcounty: "",
    parish: "",
    village: "",
    schoolType: "primary" as "primary" | "secondary" | "combined",
    ownership: "private" as "private" | "government" | "government_aided",
    selectedPackage: "starter",
    phone: "",
    email: "",
    adminName: "",
    adminPhone: "",
    password: "",
    confirmPassword: "",
  });

  const updateForm = (field: string, value: string) => {
    setForm((prev) => {
      if (field === "district") {
        return {
          ...prev,
          district: value,
          subcounty: "",
          parish: "",
          village: "",
        };
      }

      if (field === "subcounty") {
        return { ...prev, subcounty: value, parish: "", village: "" };
      }

      return { ...prev, [field]: value };
    });
    if (error) setError("");
  };

  // Validation functions
  const validateStep1 = (): boolean => {
    if (!form.schoolName.trim()) {
      setError("School name is required");
      return false;
    }
    if (form.schoolName.trim().length < 3) {
      setError("School name must be at least 3 characters");
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!form.district) {
      setError("Please select a district");
      return false;
    }
    if (!form.subcounty.trim()) {
      setError("Sub-county is required");
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!form.adminName.trim()) {
      setError("Admin name is required");
      return false;
    }
    if (form.adminName.trim().length < 2) {
      setError("Admin name must be at least 2 characters");
      return false;
    }
    if (!form.adminPhone.trim()) {
      setError("Admin phone is required");
      return false;
    }
    // Uganda phone validation
    const phoneRegex = /^(0|256|\+256)[7][0-9]{8}$/;
    const cleanPhone = form.adminPhone.replace(/[^0-9]/g, "");
    if (!phoneRegex.test(form.adminPhone.trim()) && (cleanPhone.length < 10 || cleanPhone.length > 12)) {
      setError("Please enter a valid Uganda phone number (e.g., 0700000000)");
      return false;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const goToStep = (newStep: number) => {
    setError("");
    if (newStep === 2 && !validateStep1()) return;
    if (newStep === 3 && !validateStep2()) return;
    setStep(newStep);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step !== 3) {
      return;
    }

    if (!validateStep3()) {
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: form.schoolName,
          district: form.district,
          subcounty: form.subcounty,
          schoolType: form.schoolType,
          ownership: form.ownership,
          selectedPackage: form.selectedPackage,
          phone: form.phone || null,
          email: form.email || null,
          parish: form.parish || null,
          village: form.village || null,
          adminName: form.adminName,
          adminPhone: form.adminPhone,
          password: form.password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      logger.log("Registration response:", response.status, data);

      if (!response.ok) {
        setError(data.error || `Registration failed (${response.status})`);
        setLoading(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const normalizedPhone = normalizeAuthPhone(form.adminPhone);
      const email = `${normalizedPhone}@omuto.org`;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      if (signInError) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        });

        if (retryError) {
          setError("Account created! Please go to login page and sign in.");
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      router.push("/dashboard");
    } catch (err: unknown) {
      setLoading(false);
      if (err instanceof Error && err.name === "AbortError") {
        setError(
          "Registration timed out. Profile creation may still be in progress. Try logging in shortly.",
        );
      } else {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Registration failed. Please try again.";
        setError(errorMessage);
      }
    }
  };

  return (
    <PageErrorBoundary>
    <div className="min-h-screen bg-[var(--bg)] flex flex-col justify-center relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--navy-soft)] blur-[120px] rounded-full opacity-50" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--green-soft)] blur-[120px] rounded-full opacity-30" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-white shadow-xl mb-6 ring-1 ring-slate-100">
            <SkoolMateLogo size="md" />
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--t1)] tracking-tight">
            Start Your School Account
          </h2>
          <p className="mt-2 text-[var(--t3)] font-medium">
            Join Uganda&apos;s leading school operating system
          </p>
        </div>

        <div className="mb-6">
          <div
            className="flex gap-2"
            role="navigation"
            aria-label="Registration progress"
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  s <= step
                    ? "bg-[var(--primary)] shadow-[0_0_12px_rgba(23,50,95,0.4)]"
                    : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--t3)]">
            Step {step} of 3 — Account Setup
          </p>
        </div>

        <div className="card-premium p-8 md:p-10 shadow-[0_32px_64px_rgba(15,23,42,0.1)]">
          {error && (
            <div
              className="mb-4 p-3 rounded-xl text-sm border bg-[var(--red-soft)] border-[var(--error)]/25 text-[var(--error)]"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-5">
                <Input
                  label="School Name"
                  type="text"
                  placeholder="e.g. St. Mary Primary School"
                  value={form.schoolName}
                  onChange={(e) => updateForm("schoolName", e.target.value)}
                  required
                  autoComplete="organization"
                />

                <Select
                  label="School Type"
                  options={SCHOOL_TYPE_OPTIONS}
                  value={form.schoolType}
                  onChange={(e) => updateForm("schoolType", e.target.value)}
                  required
                />

                <Select
                  label="Ownership"
                  options={OWNERSHIP_OPTIONS}
                  value={form.ownership}
                  onChange={(e) => updateForm("ownership", e.target.value)}
                  required
                />

                <Select
                  label="Package"
                  options={PACKAGE_OPTIONS}
                  value={form.selectedPackage}
                  onChange={(e) =>
                    updateForm("selectedPackage", e.target.value)
                  }
                  required
                />

                <div className="rounded-2xl bg-[var(--surface)]/70 border border-[var(--border)] p-4 text-sm text-[var(--t2)]">
                  Your school chooses its package up front. We still start you on a guided trial so the team can learn the app before payment is enforced.
                </div>

                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  icon={
                    <MaterialIcon icon="arrow_forward" className="text-lg" />
                  }
                  onClick={() => goToStep(2)}
                >
                  Next: Where is the School?
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Select
                  label="District"
                  options={DISTRICT_OPTIONS}
                  value={form.district}
                  onChange={(e) => updateForm("district", e.target.value)}
                  required
                />

                <Input
                  label="Sub-county / Division"
                  type="text"
                  placeholder="e.g. Central Division"
                  value={form.subcounty}
                  onChange={(e) => updateForm("subcounty", e.target.value)}
                  required
                  autoComplete="address-level2"
                />

                {form.district && (
                  <Select
                    label="Quick pick common Sub-counties"
                    options={[
                      { value: "", label: "Choose a common sub-county (optional)" },
                      ...getSubcountyOptions(form.district),
                    ]}
                    value={
                      getSubcountyOptions(form.district).some(
                        (option) => option.value === form.subcounty,
                      )
                        ? form.subcounty
                        : ""
                    }
                    onChange={(e) => updateForm("subcounty", e.target.value)}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Parish / Ward (Optional)"
                    type="text"
                    placeholder="e.g. Nakasero"
                    value={form.parish}
                    onChange={(e) => updateForm("parish", e.target.value)}
                    autoComplete="address-level3"
                  />
                  <Input
                    label="Village / Zone (Optional)"
                    type="text"
                    placeholder="e.g. Kisenyi Zone B"
                    value={form.village}
                    onChange={(e) => updateForm("village", e.target.value)}
                  />
                </div>

                {form.district && form.subcounty && (
                  <Select
                    label="Quick pick common Parishes"
                    options={[
                      { value: "", label: "Choose a common parish (optional)" },
                      ...getParishOptions(form.district, form.subcounty),
                    ]}
                    value={
                      getParishOptions(form.district, form.subcounty).some(
                        (option) => option.value === form.parish,
                      )
                        ? form.parish
                        : ""
                    }
                    onChange={(e) => updateForm("parish", e.target.value)}
                  />
                )}

                <div className="rounded-2xl bg-[var(--surface)]/70 border border-[var(--border)] p-4 text-sm text-[var(--t2)]">
                  We preload Uganda district, division, and parish options to reduce typing. If your area is missing, type it and continue.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="School Phone (Optional)"
                    type="tel"
                    placeholder="0700000000"
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    autoComplete="tel"
                  />
                  <Input
                    label="School Email (Optional)"
                    type="email"
                    placeholder="school@email.com"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    icon={
                      <MaterialIcon icon="arrow_back" className="text-lg" />
                    }
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="flex-1"
                    icon={
                      <MaterialIcon icon="arrow_forward" className="text-lg" />
                    }
                    onClick={() => goToStep(3)}
                  >
                    Next: Account
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <Input
                  label="Your Full Name"
                  type="text"
                  placeholder="e.g. John Mukasa"
                  value={form.adminName}
                  onChange={(e) => updateForm("adminName", e.target.value)}
                  required
                  autoComplete="name"
                />

                <Input
                  label="Your Phone Number (Login ID)"
                  type="tel"
                  placeholder="e.g. 0700000000"
                  value={form.adminPhone}
                  onChange={(e) => updateForm("adminPhone", e.target.value)}
                  required
                  autoComplete="tel"
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => updateForm("password", e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Enter password again"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    updateForm("confirmPassword", e.target.value)
                  }
                  required
                  autoComplete="new-password"
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    icon={
                      <MaterialIcon icon="arrow_back" className="text-lg" />
                    }
                    onClick={() => goToStep(2)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    loading={loading}
                    icon={
                      !loading ? (
                        <MaterialIcon icon="check" className="text-lg" />
                      ) : undefined
                    }
                  >
                    {loading ? "Setting Up..." : "Finish & Start Using"}
                  </Button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--t3)]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--primary)] hover:text-[var(--green)] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
