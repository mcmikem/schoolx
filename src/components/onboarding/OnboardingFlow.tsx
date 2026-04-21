"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import MaterialIcon from "@/components/MaterialIcon";
import OwlStage from "@/components/brand/OwlStage";
import OwlMascot from "@/components/brand/OwlMascot";
import { motion, AnimatePresence } from "framer-motion";
import { PLANS, normalizePlanType } from "@/lib/payments/subscription-client";
import {
  getDistrictOptions,
  getParishOptions,
  getSubcountyOptions,
} from "@/lib/uganda-admin";
import {
  buildUgandaAcademicTerms,
  buildUgandaCalendarEvents,
} from "@/lib/uganda-school-calendar";
import {
  buildDefaultClasses,
  buildDefaultTimetableSlots,
  type SchoolSetupType,
} from "@/lib/school-setup";
import { saveSchoolSetting } from "@/lib/school-settings";
import { getErrorMessage } from "@/lib/validation";

export default function OnboardingFlow({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { school, refreshSchool } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [branding, setBranding] = useState({
    primary_color: school?.primary_color || "#0d9488",
    logo_url: school?.logo_url || "",
  });

  // School details that can be edited during onboarding
  const [schoolDetails, setSchoolDetails] = useState({
    name: school?.name || "",
    district: (school as any)?.district || "",
    subcounty: (school as any)?.subcounty || "",
    parish: (school as any)?.parish || "",
  });
  const [schoolType, setSchoolType] = useState<SchoolSetupType>(
    ((school as any)?.school_type as SchoolSetupType) || "primary",
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
      const currentYear = new Date().getFullYear().toString();

      // Build complete update with all onboarding settings
      const updateData: any = {
        school_type: schoolType,
        name: schoolDetails.name || school.name,
        district: schoolDetails.district,
        subcounty: schoolDetails.subcounty,
        parish: schoolDetails.parish,
        primary_color: branding.primary_color,
        feature_stage: featureStage,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        setup_progress: JSON.stringify({
          completed: ["branding", "features", "activation"],
          skipped: [],
        }),
      };

      const { error } = await supabase
        .from("schools")
        .update(updateData)
        .eq("id", school.id);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      const checklistItems = [
        { item_key: "academic_calendar", item_label: "Academic Calendar" },
        { item_key: "class_structure", item_label: "Class & Stream Setup" },
        { item_key: "fee_structure", item_label: "Fee Structure" },
        { item_key: "staff_accounts", item_label: "Staff Accounts" },
        { item_key: "student_import", item_label: "Import Students" },
        { item_key: "sms_templates", item_label: "SMS Templates" },
        { item_key: "payment_methods", item_label: "Payment Methods" },
        { item_key: "grading_config", item_label: "Grading System" },
      ];

      const { error: checklistError } = await supabase
        .from("setup_checklist")
        .upsert(
          checklistItems.map((item) => ({ ...item, school_id: school.id })),
          { onConflict: "school_id,item_key" },
        );

      if (checklistError) {
        throw checklistError;
      }

      await Promise.all([
        Promise.all([
          saveSchoolSetting(school.id, "academic_year", currentYear),
          saveSchoolSetting(school.id, "current_term", "1"),
        ]),
        (async () => {
          const { count } = await supabase
            .from("classes")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id)
            .eq("academic_year", currentYear);

          if (!count) {
            const { error: classError } = await supabase
              .from("classes")
              .upsert(buildDefaultClasses(school.id, schoolType, currentYear), {
                onConflict: "school_id,name,academic_year",
              });
            if (classError) throw classError;
          }
        })(),
        (async () => {
          const { count } = await supabase
            .from("academic_terms")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id)
            .eq("academic_year", currentYear);

          if (!count) {
            const { error: termError } = await supabase
              .from("academic_terms")
              .upsert(buildUgandaAcademicTerms(school.id, currentYear), {
                onConflict: "school_id,academic_year,term_number",
              });
            if (termError) throw termError;
          }
        })(),
        (async () => {
          const { count } = await supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id)
            .in("event_type", ["academic", "holiday"]);

          if (!count) {
            const { error: eventError } = await supabase
              .from("events")
              .insert(buildUgandaCalendarEvents(school.id, currentYear));
            if (eventError) throw eventError;
          }
        })(),
        (async () => {
          const { count } = await supabase
            .from("timetable_slots")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id);

          if (!count) {
            const { error: slotError } = await supabase
              .from("timetable_slots")
              .insert(buildDefaultTimetableSlots(school.id));
            if (slotError) throw slotError;
          }
        })(),
      ]);

      await refreshSchool();
      setLoading(false);
      onComplete();
      toast.success("Setup complete. Your school can start working immediately.");
    } catch (error: unknown) {
      console.error("Final error:", error);
      toast.error(getErrorMessage(error, "Failed to save your setup. Please try again."));
      setLoading(false);
    }
  };

  const steps = [
    { title: "Welcome", icon: "waving_hand" },
    { title: "Essentials", icon: "domain" },
    { title: "Curriculum", icon: "auto_stories" },
    { title: "Features", icon: "widgets" },
    { title: "Launch", icon: "verified" },
  ];

  const selectedPlan = PLANS[normalizePlanType(school.subscription_plan)];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-xl p-4 md:p-8">
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[36px] bg-white shadow-[0_38px_90px_rgba(15,23,42,0.16)] ring-1 ring-black/5 md:flex-row">
        {/* Left Side: Progress & Info */}
        <div className="relative hidden w-1/3 flex-col overflow-hidden bg-[linear-gradient(160deg,#0b1c39_0%,#17325f_54%,#1a4b79_100%)] p-10 text-white md:flex">
          <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none">
            <div className="absolute top-[10%] right-[-20%] w-[150%] h-[50%] bg-teal-400 blur-[80px] rounded-full mix-blend-overlay"></div>
          </div>

          <div className="relative z-10">
            <SkoolMateLogo size="md" className="mb-8 brightness-0 invert" />
            <div className="mb-8">
              <OwlMascot size={84} premium ring glow animated />
            </div>

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
                <OwlStage
                  eyebrow="Launch setup"
                  title="Welcome to SkoolMate OS"
                  description="The owl will walk you through school essentials, curriculum defaults, feature activation, and launch settings in one clear flow."
                  chips={["School identity", "Curriculum defaults", "Launch-ready modules"]}
                  className="mb-8"
                />
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
                <OwlStage
                  compact
                  eyebrow="School identity"
                  title="School branding"
                  description="Set the details staff and parents recognize immediately. These choices carry through receipts, report cards, and daily communication."
                  chips={["Official school name", "Local area details", "Primary theme color"]}
                  className="mb-8"
                />

                <div className="space-y-6 mb-8">
                  {/* School Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      School Name
                    </label>
                    <Input
                      value={schoolDetails.name}
                      onChange={(e) =>
                        setSchoolDetails({
                          ...schoolDetails,
                          name: e.target.value,
                        })
                      }
                      placeholder="St. Mary's Primary School"
                    />
                  </div>

                  {/* District */}
                  <Select
                    label="District"
                    options={[
                      { value: "", label: "Select district" },
                      ...getDistrictOptions(),
                    ]}
                    value={schoolDetails.district}
                    onChange={(e) =>
                      setSchoolDetails({
                        ...schoolDetails,
                        district: e.target.value,
                        subcounty: "",
                        parish: "",
                      })
                    }
                  />

                  <Select
                    label="Subcounty / Division"
                    options={[
                      { value: "", label: "Select subcounty or division" },
                      ...getSubcountyOptions(schoolDetails.district),
                    ]}
                    value={schoolDetails.subcounty}
                    onChange={(e) =>
                      setSchoolDetails({
                        ...schoolDetails,
                        subcounty: e.target.value,
                        parish: "",
                      })
                    }
                  />

                  <Select
                    label="Parish / Ward"
                    options={[
                      { value: "", label: "Select parish or ward (optional)" },
                      ...getParishOptions(
                        schoolDetails.district,
                        schoolDetails.subcounty,
                      ),
                    ]}
                    value={schoolDetails.parish}
                    onChange={(e) =>
                      setSchoolDetails({
                        ...schoolDetails,
                        parish: e.target.value,
                      })
                    }
                  />

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      School Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { key: "primary", label: "Primary", icon: "child_care", desc: "P.1 – P.7" },
                          { key: "secondary", label: "Secondary", icon: "school", desc: "S.1 – S.6" },
                          { key: "combined", label: "Combined", icon: "account_balance", desc: "P.1 – S.6" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSchoolType(opt.key)}
                          className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-semibold transition-all ${
                            schoolType === opt.key
                              ? "border-teal-500 bg-teal-50 text-teal-700 shadow-sm"
                              : "border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          <MaterialIcon icon={opt.icon} className="text-[22px]" />
                          <span>{opt.label}</span>
                          <span className="font-normal text-[10px] opacity-70">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

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

                <div className="rounded-[24px] border border-[#e2e8f0] bg-[linear-gradient(180deg,#fbfcfe_0%,#f5f7fb_100%)] p-4 text-sm text-slate-600 shadow-sm">
                  We preload common Uganda district, division, and parish options so school leaders can finish setup quickly even on slow connections.
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
                <OwlStage
                  compact
                  eyebrow="Curriculum ready"
                  title="Classes preloaded"
                  description={`Default classes for ${schoolType === "primary" ? "a primary school" : schoolType === "secondary" ? "a secondary school" : "a combined school"} are ready for ${school.name}. You can add streams and subjects right after setup.`}
                  chips={[schoolType === "primary" ? "P.1 – P.7" : schoolType === "secondary" ? "S.1 – S.6" : "P.1 – S.6", "Subjects prepared"]}
                  className="mb-6"
                />

                <div className="mb-8 rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] p-5 shadow-sm">
                  {schoolType === "primary" && (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">P.1 to P.7 Classes</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">English, SST, Math, Science, CRE, MTC</span>
                      </div>
                    </>
                  )}
                  {schoolType === "secondary" && (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">S.1 to S.6 Classes</span>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">O-Level core subjects (Eng, Math, Bio, Chem, Hist…)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">A-Level subjects (Arts, Sciences, Commerce)</span>
                      </div>
                    </>
                  )}
                  {schoolType === "combined" && (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">P.1 – P.7 and S.1 – S.6 Classes</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MaterialIcon icon="check_circle" className="text-teal-500" />
                        <span className="font-semibold text-slate-700">Primary + secondary subjects prepared</span>
                      </div>
                    </>
                  )}
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
                <OwlStage
                  compact
                  eyebrow="Module access"
                  title="Select your features"
                  description="Turn on the modules your school needs immediately. Start lean or go full-suite, then expand later without losing continuity."
                  chips={[selectedPlan.name, "Flexible rollout"]}
                  className="mb-6"
                />

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
                    Review & Launch
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
                  Launch Ready
                </h3>
                <p className="text-slate-500 mb-6">
                  Your school package, default calendar, and starter setup are already in place so the team can begin working immediately.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800">Chosen Package</h4>
                      <MaterialIcon icon="workspace_premium" className="text-teal-600" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {selectedPlan.name}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      The school selected this package during registration. Billing can be refined later in Subscription Settings.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800">Calendar Ready</h4>
                      <MaterialIcon icon="calendar_month" className="text-blue-600" />
                    </div>
                    <p className="text-sm text-slate-500">
                      Uganda term dates and holiday windows are preloaded from the latest published school calendar pattern. Headteachers can tweak them later if a circular changes.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 mb-8">
                  <div className="flex items-start gap-3">
                    <MaterialIcon icon="bolt" className="text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-800 mb-1">
                        Rural-first setup
                      </p>
                      <p className="text-sm text-slate-500">
                        We keep the first-run flow short, preload local school details, and avoid forcing payment or heavy setup before staff can start using the system.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto">
                  <Button variant="secondary" onClick={() => setStep(4)}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleComplete}
                    loading={loading}
                    className="flex-1"
                  >
                    Finish Setup
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
