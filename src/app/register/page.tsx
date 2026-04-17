"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import AuthShell from "@/components/auth/AuthShell";
import { Button, Input, Select } from "@/components/ui";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

const DISTRICTS = [
  "Kampala",
  "Wakiso",
  "Mukono",
  "Jinja",
  "Mbale",
  "Gulu",
  "Lira",
  "Masaka",
  "Mbarara",
  "Fort Portal",
  "Kabale",
  "Soroti",
  "Arua",
  "Hoima",
  "Masindi",
  "Tororo",
  "Busia",
  "Iganga",
  "Kamuli",
  "Apac",
  "Entebbe",
  "Kasese",
  "Kitgum",
  "Moroto",
];

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
  ...DISTRICTS.map((district) => ({ value: district, label: district })),
];

const STEP_DETAILS = [
  {
    number: 1,
    label: "School setup",
    helper: "Tell us the kind of school you run.",
  },
  {
    number: 2,
    label: "Location",
    helper: "Add the district and school contacts.",
  },
  {
    number: 3,
    label: "Admin access",
    helper: "Create the first login for the school.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    schoolName: "",
    district: "",
    subcounty: "",
    schoolType: "primary" as "primary" | "secondary" | "combined",
    ownership: "private" as "private" | "government" | "government_aided",
    phone: "",
    email: "",
    adminName: "",
    adminPhone: "",
    password: "",
    confirmPassword: "",
  });

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

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

    const cleanPhone = form.adminPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 12) {
      setError(
        "Use a valid Uganda phone number, e.g. 0700000000 or 256700000000",
      );
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

  const goToStep = (nextStep: number) => {
    setError("");
    if (nextStep === 2 && !validateStep1()) return;
    if (nextStep === 3 && !validateStep2()) return;
    setStep(nextStep);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step !== 3 || !validateStep3()) {
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
          phone: form.phone || null,
          email: form.email || null,
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

      const normalizedPhone = form.adminPhone.replace(/[^0-9]/g, "");
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

  const currentStep = STEP_DETAILS[step - 1];

  return (
    <AuthShell
      badge="Create a school account"
      title="Register your school"
      description="Fill in the school details, choose the location, and create the first admin login."
      quickFacts={[
        "3 short setup steps",
        "Uses Uganda phone and district details",
        "Easy to complete on phone or computer",
      ]}
      highlights={[
        {
          icon: "how_to_reg",
          title: "Step 1: School details",
          description:
            "Enter the school name, type, and ownership.",
        },
        {
          icon: "location_on",
          title: "Step 2: Location",
          description:
            "Choose the district and add the main school contacts.",
        },
        {
          icon: "person_add",
          title: "Step 3: Admin login",
          description:
            "Create the first staff account that will open the dashboard.",
        },
        {
          icon: "wifi_off",
          title: "If network is slow",
          description:
            "Finish one step at a time and wait for the account to complete setup before trying again.",
        },
      ]}
      contentTitle={`Step ${step} of 3 · ${currentStep.label}`}
      contentDescription={currentStep.helper}
      supportNote={
        <div className="space-y-2">
          <p className="font-semibold text-slate-800">Before you continue</p>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>• Use the main school or administrator phone number.</li>
            <li>• Pick the district where the school operates today.</li>
            <li>• You can add students, classes, and staff after signup.</li>
          </ul>
        </div>
      }
      footer={
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#17325F] transition hover:text-[#2E9448]"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div
            className="flex gap-2"
            role="navigation"
            aria-label="Registration progress"
          >
            {STEP_DETAILS.map((item) => (
              <div
                key={item.number}
                className={`h-2 flex-1 rounded-full transition-all ${
                  item.number <= step ? "bg-[#17325F]" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {STEP_DETAILS.map((item) => (
              <div
                key={item.number}
                className={`rounded-[20px] border p-3 transition ${
                  item.number === step
                    ? "border-[#17325F]/20 bg-white text-slate-900 shadow-sm"
                    : "border-transparent bg-transparent text-slate-500"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Step {item.number}
                </p>
                <p className="mt-1 text-sm font-semibold">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <div
            className="rounded-[22px] border border-[var(--error)]/20 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--error)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 ? (
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

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Good to know
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use the official school name that appears on reports,
                  receipts, or registration records.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full rounded-2xl py-3 text-base"
                icon={<MaterialIcon icon="arrow_forward" size={18} />}
                onClick={() => goToStep(2)}
              >
                Continue to location
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <Select
                label="District"
                options={DISTRICT_OPTIONS}
                value={form.district}
                onChange={(e) => updateForm("district", e.target.value)}
                required
              />

              <Input
                label="Sub-county"
                type="text"
                placeholder="e.g. Central Division"
                value={form.subcounty}
                onChange={(e) => updateForm("subcounty", e.target.value)}
                required
                autoComplete="address-level2"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="School Phone (Optional)"
                  type="tel"
                  placeholder="0700000000"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  autoComplete="tel"
                  inputMode="numeric"
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

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 rounded-2xl py-3 text-base"
                  icon={<MaterialIcon icon="arrow_back" size={18} />}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 rounded-2xl py-3 text-base"
                  icon={<MaterialIcon icon="arrow_forward" size={18} />}
                  onClick={() => goToStep(3)}
                >
                  Continue to admin access
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
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
                inputMode="numeric"
              />

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="rounded-lg p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <MaterialIcon
                      icon={showPassword ? "visibility_off" : "visibility"}
                      size={18}
                    />
                  </button>
                }
              />

              <Input
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Enter password again"
                value={form.confirmPassword}
                onChange={(e) => updateForm("confirmPassword", e.target.value)}
                required
                autoComplete="new-password"
                endAdornment={
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                    className="rounded-lg p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    <MaterialIcon
                      icon={
                        showConfirmPassword ? "visibility_off" : "visibility"
                      }
                      size={18}
                    />
                  </button>
                }
              />

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  After signup
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  After this, you can open the dashboard and start adding
                  learners, classes, and fees.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 rounded-2xl py-3 text-base"
                  icon={<MaterialIcon icon="arrow_back" size={18} />}
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 rounded-2xl py-3 text-base"
                  loading={loading}
                  icon={!loading ? <MaterialIcon icon="check" size={18} /> : undefined}
                >
                  {loading ? "Creating account..." : "Create school account"}
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </AuthShell>
  );
}
