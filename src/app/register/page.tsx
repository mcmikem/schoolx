// ============================================================================
// 🔒 LOCKED DOWN — REGISTER PAGE (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// Critical user-facing registration flow. Changes can break school creation,
// Google OAuth registration, auto sign-in, and location-based district selection.
//
// Last audited: 2026-05-12 | Bugs fixed: 3
// Known pitfalls:
//   - Auto sign-in must try BOTH user-provided email AND @omuto.org fallback
//   - Google OAuth mode redirects to /auth/callback?next=/register
//   - Registration API uses /api/register/ (password) or /api/register/oauth/ (Google)
//   - All redirects must use router.replace() not router.push()
//   - Uganda phone validation: /^(0|256|\+256)[7][0-9]{8}$/  (e.g. 0700000000, +256700000000)
//   - Password requirements: 8+ chars, 1 uppercase, 1 number
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

import { logger } from "@/lib/logger";
import { Button, Input, Select } from "@/components/ui";
import {
  getDistrictOptions,
  getSubcountyOptions,
  getParishOptions,
} from "@/lib/uganda-admin";
import { normalizeAuthPhone } from "@/lib/validation";
import { withSupabaseLockRetry } from "@/lib/supabase-lock";
import MaterialIcon from "@/components/MaterialIcon";
import { useFormValidation, ValidationRules, ValidatedInput } from "@/lib/useFormValidation";

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
  { value: "", label: "Choose a common district (optional)" },
  ...getDistrictOptions(),
];

const SUPPORT_PHONE = "+256700000000";
const SUPPORT_WHATSAPP_URL = "https://wa.me/256700000000";

// Package is always defaulted to starter at registration; user upgrades later

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [manualLocationEntry, setManualLocationEntry] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAdvancedSchoolDetails, setShowAdvancedSchoolDetails] = useState(false);
  const [showOptionalContacts, setShowOptionalContacts] = useState(false);

  const googleRegisterMode = searchParams?.get("oauth") === "1";

  // Reset spinner if user navigates back from Google OAuth tab
  useEffect(() => {
    if (!googleLoading) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => setGoogleLoading(false), 1500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [googleLoading]);

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

  const rules = {
    schoolName: ValidationRules.required,
    district: ValidationRules.required,
    phone: ValidationRules.phone,
    email: ValidationRules.email,
    adminName: { ...ValidationRules.required, ...ValidationRules.studentName },
    adminPhone: { ...ValidationRules.required, ...ValidationRules.phone },
    password: { required: true, minLength: 8 },
  };
  const formValidation = useFormValidation(rules);

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
    if (apiError) setApiError("");
  };

  // Validation functions
  const validateStep1 = (): boolean => {
    if (!form.schoolName.trim()) {
      setApiError("School name is required");
      return false;
    }
    if (form.schoolName.trim().length < 3) {
      setApiError("School name must be at least 3 characters");
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!form.district) {
      setApiError("Please select a district");
      return false;
    }
    if (!form.subcounty.trim()) {
      setApiError("Sub-county is required");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!googleRegisterMode) return;
    const emailParam = searchParams?.get("email");
    if (emailParam) {
      updateForm("email", emailParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleRegisterMode, searchParams]);

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/register")}`
          : undefined;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
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

      if (oauthError) throw oauthError;
    } catch (oauthError: unknown) {
      setApiError(
        oauthError instanceof Error
          ? oauthError.message
          : "Google sign-up failed. Please try again.",
      );
      setGoogleLoading(false);
    }
  };

  const goToStep = (newStep: number) => {
    setApiError("");
    formValidation.clearErrors();
    if (newStep === 2 && !validateStep1()) return;
    if (newStep === 3 && !validateStep2()) return;
    setStep(newStep);
  };

  const useSuggestedPassword = () => {
    const firstName = form.adminName.trim().split(" ")[0] || "School";
    const normalized = firstName.replace(/[^a-zA-Z]/g, "") || "School";
    const suggestedPassword = `${normalized}2026A`;
    updateForm("password", suggestedPassword);
    updateForm("confirmPassword", suggestedPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");

    if (step !== 3) {
      return;
    }

    formValidation.clearErrors();

    if (!googleRegisterMode && form.password !== form.confirmPassword) {
      setApiError("Passwords do not match");
      formValidation.markTouched("password");
      return;
    }

    if (!formValidation.validate(form)) {
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const endpoint = googleRegisterMode ? "/api/register/oauth/" : "/api/register/";

      const response = await fetch(endpoint, {
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
          password: googleRegisterMode ? undefined : form.password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: Record<string, unknown>;
      try {
        data = await response.json();
      } catch {
        setApiError("Registration failed. Please check your connection and try again.");
        setLoading(false);
        return;
      }
      logger.log("Registration response:", response.status, data);

      if (!response.ok) {
        setApiError((data.error as string) || `Registration failed (${response.status})`);
        setLoading(false);
        return;
      }

      if (googleRegisterMode) {
        setLoading(false);
router.replace("/dashboard/");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const normalizedPhone = normalizeAuthPhone(form.adminPhone);
      const hasValidEmail = form.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      const emailCandidates = hasValidEmail
        ? [form.email.toLowerCase(), `${normalizedPhone}@omuto.org`]
        : [`${normalizedPhone}@omuto.org`];

      // Try auto sign-in up to 4 times with progressive back-off.
      // Supabase sometimes needs a few seconds to propagate the new auth user.
      let signedIn = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
        const emailToTry = emailCandidates[attempt % emailCandidates.length];
        const { data: attemptData, error: attemptError } = await withSupabaseLockRetry(
          async () =>
            await supabase.auth.signInWithPassword({
              email: emailToTry,
              password: form.password,
            }),
        );
        if (!attemptError && (attemptData?.session || attemptData?.user)) {
          signedIn = true;
          break;
        }
      }

      if (!signedIn) {
        // Registration succeeded but auto sign-in failed after retries.
        // Send to login with a pre-filled phone so the user just enters password.
        router.replace(
          "/login?registered=1&phone=" + encodeURIComponent(form.adminPhone),
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      router.replace("/dashboard/");
    } catch (err: unknown) {
      setLoading(false);
      if (err instanceof Error && err.name === "AbortError") {
        setApiError(
          "Registration timed out. Profile creation may still be in progress. Try logging in shortly.",
        );
      } else {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Registration failed. Please try again.";
        setApiError(errorMessage);
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
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--t3)] hover:text-[var(--primary)] transition-colors"
            >
              <MaterialIcon icon="arrow_back" className="text-[16px]" />
              Back to home
            </Link>
          </div>
          <div className="mb-8">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--navy)]/10 bg-[var(--navy-soft)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--navy)]">
                <MaterialIcon icon="school" className="text-sm" />
                Register your school
              </div>
            </div>
            <h1 className="font-['Sora'] text-[30px] font-semibold tracking-[-0.03em] text-[#102341] mb-3">
              Set up your school in a few simple steps
            </h1>
            <p className="text-[15px] leading-6 text-[#53657f] mb-4">
              No technical skills needed. We guide you step by step, and you can
              finish the basics in about 3 minutes.
            </p>
            <p className="text-sm text-[var(--t3)]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--primary)] hover:text-[var(--green)] transition-colors"
              >
                Sign in
              </Link>
            </p>
            {!googleRegisterMode && (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  loading={googleLoading}
                  onClick={handleGoogleRegister}
                  icon={<MaterialIcon icon="account_circle" className="text-lg" />}
                >
                  Continue with Google
                </Button>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--t2)]">
              <p className="font-semibold text-[var(--t1)]">Need help while setting up?</p>
              <p className="mt-1">Call {SUPPORT_PHONE} or message us on WhatsApp and we can guide you live.</p>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-[var(--primary)] font-semibold hover:underline"
              >
                <MaterialIcon icon="chat" className="text-base" />
                Open WhatsApp support
              </a>
            </div>
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
              {step === 1
                ? "Step 1 of 3 — Your School"
                : step === 2
                  ? "Step 2 of 3 — Location"
                  : "Step 3 of 3 — Admin Account"}
            </p>
            <p className="mt-2 text-center text-xs text-[var(--t3)]">
              {step === 1
                ? "Start with your school name. Extra details can be added later."
                : step === 2
                  ? "Pick your district and sub-county. Use manual entry if needed."
                  : "Create your login details. We recommend saving your password in a notebook."}
            </p>
          </div>

          <div className="card-premium p-8 md:p-10 shadow-[0_32px_64px_rgba(15,23,42,0.1)]">
            {apiError && (
              <div
                className="mb-4 p-3 rounded-xl text-sm border bg-[var(--red-soft)] border-[var(--error)]/25 text-[var(--error)]"
                role="alert"
              >
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="space-y-5">
                  <ValidatedInput
                    label="School Name"
                    type="text"
                    placeholder="e.g. St. Mary Primary School"
                    value={form.schoolName}
                    onChange={(e) => updateForm("schoolName", e.target.value)}
                    required
                    autoComplete="organization"
                    error={formValidation.getFieldError("schoolName")}
                    touched={formValidation.isTouched("schoolName")}
                    onTouched={() => formValidation.markTouched("schoolName")}
                  />

                  <p className="text-xs text-[var(--t3)] -mt-2">
                    Example: St. Mary Primary School, Gulu High School, Bright Future Academy.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedSchoolDetails((prev) => !prev)}
                    className="w-full text-left rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--t1)] hover:bg-[var(--bg)]"
                  >
                    {showAdvancedSchoolDetails
                      ? "Hide advanced school details"
                      : "Set school type and ownership (optional now)"}
                  </button>

                  {showAdvancedSchoolDetails && (
                    <div className="space-y-4 rounded-xl border border-[var(--border)] p-4 bg-[var(--bg)]">
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
                  )}

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
                  <p className="text-sm text-[var(--t3)]">
                    Select from common Uganda locations to reduce typing. If your area is missing,
                    switch to manual entry.
                  </p>

                  {!manualLocationEntry ? (
                    <Select
                      label="District"
                      options={[
                        { value: "", label: "Browse common districts..." },
                        ...getDistrictOptions(),
                      ]}
                      value={
                        DISTRICT_OPTIONS.some(
                          (o) => o.value === form.district && o.value !== "",
                        )
                          ? form.district
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          updateForm("district", e.target.value);
                          updateForm("subcounty", "");
                          updateForm("parish", "");
                        }
                        formValidation.markTouched("district");
                      }}
                      required
                      autoComplete="address-level1"
                    />
                  ) : (
                    <>
                      <Select
                        label="District Suggestions"
                        options={[
                          { value: "", label: "Browse common districts..." },
                          ...getDistrictOptions(),
                        ]}
                        value={
                          DISTRICT_OPTIONS.some(
                            (o) => o.value === form.district && o.value !== "",
                          )
                            ? form.district
                            : ""
                        }
                        onChange={(e) => {
                          if (e.target.value) {
                            updateForm("district", e.target.value);
                            updateForm("subcounty", "");
                            updateForm("parish", "");
                          }
                        }}
                        autoComplete="address-level1"
                      />
                      <ValidatedInput
                        label="District"
                        type="text"
                        placeholder="Type your district"
                        value={form.district}
                        onChange={(e) => updateForm("district", e.target.value)}
                        required
                        autoComplete="address-level1"
                        error={formValidation.getFieldError("district")}
                        touched={formValidation.isTouched("district")}
                        onTouched={() => formValidation.markTouched("district")}
                      />
                    </>
                  )}
                  {formValidation.isTouched("district") && formValidation.getFieldError("district") && (
                    <p className="text-sm text-[var(--error)]">{formValidation.getFieldError("district")}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <MaterialIcon icon="help" className="text-xs align-middle" />
                    We preload Uganda district, division, and parish options to
                    reduce typing. If your area is missing, switch to manual entry.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualLocationEntry((prev) => !prev);
                      setApiError("");
                    }}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    {manualLocationEntry ? "Use district suggestions instead" : "My area is not listed, enter location manually"}
                  </button>

                  {!manualLocationEntry ? (
                    <Select
                      label="Sub-county / Division"
                      options={[
                        { value: "", label: "Browse sub-counties..." },
                        ...(form.district
                          ? getSubcountyOptions(form.district)
                          : []),
                      ]}
                      value={
                        form.district &&
                        getSubcountyOptions(form.district).some(
                          (o) => o.value === form.subcounty,
                        )
                          ? form.subcounty
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value)
                          updateForm("subcounty", e.target.value);
                      }}
                      required
                      autoComplete="address-level2"
                      disabled={!form.district}
                    />
                  ) : (
                    <Input
                      label="Sub-county / Division"
                      type="text"
                      placeholder="Type your sub-county or division"
                      value={form.subcounty}
                      onChange={(e) => updateForm("subcounty", e.target.value)}
                      required
                      autoComplete="address-level2"
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!manualLocationEntry ? (
                      <Select
                        label="Parish / Ward (Optional)"
                        options={[
                          {
                            value: "",
                            label: "Browse common parishes (optional)...",
                          },
                          ...(form.district && form.subcounty
                            ? getParishOptions(form.district, form.subcounty)
                            : []),
                        ]}
                        value={
                          form.district &&
                          form.subcounty &&
                          getParishOptions(form.district, form.subcounty).some(
                            (option) => option.value === form.parish,
                          )
                            ? form.parish
                            : ""
                        }
                        onChange={(e) => updateForm("parish", e.target.value)}
                        autoComplete="address-level3"
                        disabled={!form.district || !form.subcounty}
                      />
                    ) : (
                      <Input
                        label="Parish / Ward (Optional)"
                        type="text"
                        placeholder="Type your parish or ward"
                        value={form.parish}
                        onChange={(e) => updateForm("parish", e.target.value)}
                        autoComplete="address-level3"
                      />
                    )}
                    <Input
                      label="Village / Zone (Optional)"
                      type="text"
                      placeholder="e.g. Kisenyi Zone B"
                      value={form.village}
                      onChange={(e) => updateForm("village", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setShowOptionalContacts((prev) => !prev)}
                      className="sm:col-span-2 text-left rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--t1)] hover:bg-[var(--bg)]"
                    >
                      {showOptionalContacts
                        ? "Hide optional school contacts"
                        : "Add school phone and email (optional)"}
                    </button>

                    {showOptionalContacts && (
                      <>
                        <ValidatedInput
                          label="School Phone (Optional)"
                          type="tel"
                          placeholder="0700000000"
                          value={form.phone}
                          onChange={(e) => updateForm("phone", e.target.value)}
                          autoComplete="tel"
                          error={formValidation.getFieldError("phone")}
                          touched={formValidation.isTouched("phone")}
                          onTouched={() => formValidation.markTouched("phone")}
                        />
                        <ValidatedInput
                          label="School Email (Optional)"
                          type="email"
                          placeholder="school@email.com"
                          value={form.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          autoComplete="email"
                          error={formValidation.getFieldError("email")}
                          touched={formValidation.isTouched("email")}
                          onTouched={() => formValidation.markTouched("email")}
                        />
                      </>
                    )}
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
                        <MaterialIcon
                          icon="arrow_forward"
                          className="text-lg"
                        />
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
                  {googleRegisterMode && (
                    <div className="rounded-xl border border-[var(--navy)]/15 bg-[var(--navy-soft)] p-3 text-sm text-[var(--navy)]">
                      Google account linked. Complete these details to create your school workspace.
                    </div>
                  )}

                  <ValidatedInput
                    label="Your Full Name"
                    type="text"
                    placeholder="e.g. John Mukasa"
                    value={form.adminName}
                    onChange={(e) => updateForm("adminName", e.target.value)}
                    required
                    autoComplete="name"
                    error={formValidation.getFieldError("adminName")}
                    touched={formValidation.isTouched("adminName")}
                    onTouched={() => formValidation.markTouched("adminName")}
                  />

                  <ValidatedInput
                    label="Your Phone Number (Login ID)"
                    type="tel"
                    placeholder="e.g. 0700000000"
                    value={form.adminPhone}
                    onChange={(e) => updateForm("adminPhone", e.target.value)}
                    required
                    autoComplete="tel"
                    error={formValidation.getFieldError("adminPhone")}
                    touched={formValidation.isTouched("adminPhone")}
                    onTouched={() => formValidation.markTouched("adminPhone")}
                  />

                  <p className="text-xs text-[var(--t3)] -mt-2">
                    Use a number you always access. Example: 0700000000.
                  </p>

                  {!googleRegisterMode && (
                    <>
                      <ValidatedInput
                        label="Password"
                        type="password"
                        placeholder="Min 8 characters"
                        value={form.password}
                        onChange={(e) => updateForm("password", e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        error={formValidation.getFieldError("password")}
                        touched={formValidation.isTouched("password")}
                        onTouched={() => formValidation.markTouched("password")}
                      />

                      <button
                        type="button"
                        onClick={useSuggestedPassword}
                        className="text-sm font-semibold text-[var(--primary)] hover:underline"
                      >
                        Use a suggested password for me
                      </button>

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
                    </>
                  )}

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
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
