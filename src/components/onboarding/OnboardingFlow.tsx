"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import MaterialIcon from "@/components/MaterialIcon";
import { motion, AnimatePresence } from "framer-motion";
import { t } from "@/i18n";

export default function OnboardingFlow({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { school, user, refreshSchool } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [branding, setBranding] = useState({
    primary_color: school?.primary_color || "#0d9488",
    logo_url: school?.logo_url || "",
  });

  const [activationChoice, setActivationChoice] = useState<"trial" | "premium">(
    "trial",
  );
  const [featureStage, setFeatureStage] = useState<
    "core" | "academic" | "finance" | "full"
  >(
    (school?.feature_stage as "core" | "academic" | "finance" | "full") ||
      "core",
  );

  // Prevent background scrolling while onboarding is active
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  if (!school) return null;

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Simple update - just primary_color, subscription_status, and trial_ends_at
      // These columns definitely exist in the schema
      const updateData = {
        primary_color: branding.primary_color,
        subscription_status:
          activationChoice === "premium" ? "active" : "trial",
        trial_ends_at:
          activationChoice === "trial"
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
      };

      const { error } = await supabase
        .from("schools")
        .update(updateData)
        .eq("id", school.id);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      await refreshSchool();
      setLoading(false);
      onComplete();

      if (activationChoice === "premium") {
        window.location.href = "/dashboard/settings?tab=subscription";
      } else {
        toast.success("Welcome aboard! Your 30-day trial is active.");
      }
    } catch (error: any) {
      console.error("Final error:", error);
      toast.error(
        error.message || "Failed to save your setup. Please try again.",
      );
      setLoading(false);
    }
  };

  const steps = [
    { title: "Welcome", icon: "waving_hand" },
    { title: "Branding", icon: "palette" },
    { title: "Curriculum", icon: "auto_stories" },
    { title: "Features", icon: "widgets" },
    { title: "Activation", icon: "verified" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-xl p-4 md:p-8">
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row relative ring-1 ring-black/5">
        {/* Left Side: Progress & Info */}
        <div className="hidden md:flex flex-col w-1/3 bg-gradient-to-br from-[var(--primary)] to-[var(--navy-soft)] p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none">
            <div className="absolute top-[10%] right-[-20%] w-[150%] h-[50%] bg-teal-400 blur-[80px] rounded-full mix-blend-overlay"></div>
          </div>

          <div className="relative z-10">
            <SkoolMateLogo size="md" className="mb-12 brightness-0 invert" />

            <h2 className="text-3xl font-bold mb-8">Setup Your Campus</h2>

            <div className="space-y-6">
              {steps.map((s, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === step;
                const isPassed = stepNum < step;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 transition-opacity ${isActive || isPassed ? "opacity-100" : "opacity-40"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                      ${isPassed ? "bg-teal-400 border-teal-400" : isActive ? "border-white" : "border-white/30"}`}
                    >
                      {isPassed ? (
                        <MaterialIcon
                          icon="check"
                          className="text-white text-lg"
                        />
                      ) : (
                        <MaterialIcon
                          icon={s.icon}
                          className={`text-lg ${isActive ? "text-white" : "text-white/50"}`}
                        />
                      )}
                    </div>
                    <span
                      className={`font-medium ${isActive ? "text-white text-lg" : "text-white/70"}`}
                    >
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Step Content */}
        <div className="flex-1 flex flex-col p-8 md:p-12 relative min-h-[500px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-center max-w-md"
              >
                <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-6">
                  <MaterialIcon
                    icon="rocket_launch"
                    className="text-3xl text-teal-600"
                  />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Welcome to SkoolMate OS
                </h3>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  You are now running on Africa's most advanced school operating
                  system. Let's get your campus configured in the next 60
                  seconds so you can start managing fees, students, and teachers
                  instantly.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                  className="w-max"
                  icon={<MaterialIcon icon="arrow_forward" />}
                >
                  Let's Begin
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-center max-w-md"
              >
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  School Branding
                </h3>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Personalize the dashboard with your school's official colors.
                  This color will appear on receipts, report cards, and parent
                  SMS links.
                </p>

                <div className="space-y-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Primary Theme Color
                    </label>
                    <div className="flex gap-4">
                      {[
                        "#0d9488",
                        "#2563eb",
                        "#0f172a",
                        "#16a34a",
                        "#dc2626",
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            setBranding({ ...branding, primary_color: color })
                          }
                          className={`w-12 h-12 rounded-full border-[3px] transition-transform hover:scale-110 ${branding.primary_color === color ? "border-slate-800 ring-2 ring-offset-2 ring-slate-200" : "border-transparent"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          value={branding.primary_color}
                          onChange={(e) =>
                            setBranding({
                              ...branding,
                              primary_color: e.target.value,
                            })
                          }
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                          <MaterialIcon icon="add" className="text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(3)}>
                    Next Step
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-center max-w-md"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                  <MaterialIcon
                    icon="verified"
                    className="text-3xl text-blue-600"
                  />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Curriculum Preloaded
                </h3>
                <p className="text-slate-500 mb-6 leading-relaxed">
                  We've done the heavy lifting. Standard Ugandan curriculum
                  subjects and classes have been automatically generated for{" "}
                  <strong>{school.name}</strong>.
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <MaterialIcon
                      icon="check_circle"
                      className="text-teal-500"
                    />
                    <span className="font-semibold text-slate-700">
                      P.1 to P.7 Classes Ready
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MaterialIcon
                      icon="check_circle"
                      className="text-teal-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Core Subjects (English, SST, Math, Sci)
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(4)}>
                    Choose Features
                  </Button>
                </div>
              </motion.div>
            )}

            {/* NEW STEP: Feature Stage Selection */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-center max-w-md"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-6">
                  <MaterialIcon
                    icon="widgets"
                    className="text-3xl text-purple-600"
                  />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Select Your Features
                </h3>
                <p className="text-slate-500 mb-6 leading-relaxed">
                  Choose which modules to enable now. You can always add more
                  features later from Settings.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    {
                      key: "core",
                      label: "Core Essentials",
                      desc: "Attendance, Students, Basic Reports",
                      icon: "school",
                    },
                    {
                      key: "academic",
                      label: "Academic Focus",
                      desc: "Core + Grades, Exams, Report Cards",
                      icon: "menu_book",
                    },
                    {
                      key: "finance",
                      label: "Finance & Operations",
                      desc: "Core + Fees, Payroll, Budgeting",
                      icon: "account_balance",
                    },
                    {
                      key: "full",
                      label: "Full Suite",
                      desc: "Everything including Parent Portal, Analytics",
                      icon: "rocket_launch",
                    },
                  ].map((option) => (
                    <div
                      key={option.key}
                      onClick={() => setFeatureStage(option.key as any)}
                      className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${featureStage === option.key ? "border-purple-500 bg-purple-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="flex items-center gap-3">
                        <MaterialIcon
                          icon={option.icon}
                          className={
                            featureStage === option.key
                              ? "text-purple-600"
                              : "text-slate-400"
                          }
                        />
                        <div>
                          <h4 className="font-semibold text-slate-800">
                            {option.label}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {option.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 mt-auto">
                  <Button variant="secondary" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(5)}>
                    Proceed to Activation
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-center w-full"
              >
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Choose Activation
                </h3>
                <p className="text-slate-500 mb-6">
                  How would you like to proceed with your subscription?
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div
                    onClick={() => setActivationChoice("trial")}
                    className={`cursor-pointer rounded-2xl border-2 p-5 transition-all ${activationChoice === "trial" ? "border-teal-500 bg-teal-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-800">
                        30-Day Free Trial
                      </h4>
                      <MaterialIcon
                        icon={
                          activationChoice === "trial"
                            ? "radio_button_checked"
                            : "radio_button_unchecked"
                        }
                        className={
                          activationChoice === "trial"
                            ? "text-teal-500"
                            : "text-slate-300"
                        }
                      />
                    </div>
                    <p className="text-sm text-slate-500">
                      Full access to all features. No credit card or mobile
                      money required upfront.
                    </p>
                  </div>

                  <div
                    onClick={() => setActivationChoice("premium")}
                    className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative overflow-hidden ${activationChoice === "premium" ? "border-[var(--primary)] bg-blue-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="absolute top-0 right-0 bg-[var(--primary)] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                      RECOMMENDED
                    </div>
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-800">
                        Pay Premium Now
                      </h4>
                      <MaterialIcon
                        icon={
                          activationChoice === "premium"
                            ? "radio_button_checked"
                            : "radio_button_unchecked"
                        }
                        className={
                          activationChoice === "premium"
                            ? "text-[var(--primary)]"
                            : "text-slate-300"
                        }
                      />
                    </div>
                    <p className="text-sm text-slate-500">
                      Pay securely via MTN MoMo or Airtel Money to secure full
                      licensing for the academic year.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto">
                  <Button variant="secondary" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleComplete}
                    loading={loading}
                    className="flex-1"
                  >
                    {activationChoice === "trial"
                      ? "Start Free Trial"
                      : "Proceed to Payment"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
