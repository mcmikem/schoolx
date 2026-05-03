"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
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
import { PRIMARY_TEMPLATE, SECONDARY_TEMPLATE } from "@/lib/curriculum-templates";
import { logger } from "@/lib/logger";
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
    accent_color: school?.accent_color || "#3b82f6",
    logo_url: school?.logo_url || "",
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // School details that can be edited during onboarding
  const [schoolDetails, setSchoolDetails] = useState({
    name: school?.name || "",
    district: school?.district || "",
    subcounty: school?.subcounty || "",
    parish: school?.parish || "",
    motto: school?.motto || "",
    phone: school?.phone || "",
    email: school?.email || "",
    uneb_center_number: school?.uneb_center_number || ((school as unknown as Record<string, unknown>)?.uneab_center_number as string) || "",
    ownership: school?.ownership || "private",
    address: school?.address || "",
  });
  const [schoolType, setSchoolType] = useState<SchoolSetupType>(
    (school?.school_type as SchoolSetupType) || "primary",
  );
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !school?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingLogo(true);
    try {
      const compressed = await compressImage(file, 800, 800, 0.8);
      const ext = file.name.split(".").pop() || "png";
      const filePath = `school-${school.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(filePath, compressed, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("school-logos")
        .getPublicUrl(filePath);
      const logoUrl = urlData?.publicUrl;
      if (logoUrl) {
        setBranding((prev) => ({ ...prev, logo_url: logoUrl }));
        const { error: updateError } = await supabase
          .from("schools")
          .update({ logo_url: logoUrl })
          .eq("id", school.id);
        if (updateError) logger.warn("Logo URL save failed:", updateError);
      }
      toast.success("Logo uploaded");
    } catch (err) {
      logger.error("Logo upload failed:", err);
      toast.error("Failed to upload logo. You can add it later in settings.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const compressImage = (
    file: File,
    maxW: number,
    maxH: number,
    quality: number,
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        if (h > maxH) { w = w * maxH / h; h = maxH; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Compression failed")), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  };

  const [featureStage, setFeatureStage] = useState<
    "core" | "academic" | "finance" | "full"
  >(
    (school?.feature_stage as "core" | "academic" | "finance" | "full") ||
      "core",
  );

  const getTemplateForType = (type: SchoolSetupType) => {
    if (type === "secondary") return SECONDARY_TEMPLATE;
    if (type === "combined")
      return {
        classes: [...PRIMARY_TEMPLATE.classes, ...SECONDARY_TEMPLATE.classes],
        subjects: [
          ...PRIMARY_TEMPLATE.subjects,
          ...SECONDARY_TEMPLATE.subjects,
        ],
      };
    return PRIMARY_TEMPLATE;
  };

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() =>
    getTemplateForType(schoolType).subjects.map((s) => s.name),
  );

  const ADDITIONAL_OPTIONAL_SUBJECTS: { name: string; code: string }[] = [
    { name: "Music", code: "MUS" },
    { name: "Physical Education", code: "PE" },
    { name: "Islamic Studies", code: "ISL" },
    { name: "Arabic", code: "ARB" },
    { name: "French", code: "FRN" },
    { name: "Additional Mathematics", code: "ADM" },
    { name: "Home Economics", code: "HEC" },
  ];

  const [boardingConfig, setBoardingConfig] = useState<{
    hasBoarding: boolean;
    dormCount: number;
    dormitories: { name: string; type: "boys" | "girls"; capacity: number }[];
    hasHouses: boolean;
    houseCount: number;
    houses: string[];
  }>({
    hasBoarding: false,
    dormCount: 1,
    dormitories: [{ name: "", type: "boys", capacity: 40 }],
    hasHouses: false,
    houseCount: 1,
    houses: [""],
  });

  useEffect(() => {
    setSelectedSubjects(getTemplateForType(schoolType).subjects.map((s) => s.name));
  }, [schoolType]);

  // Prevent background scrolling while onboarding is active (desktop only)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      document.body.style.overflow = "";
      mq.removeEventListener("change", apply);
    };
  }, []);

  if (!school) return null;

  const handleComplete = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear().toString();

      // Build complete update with all onboarding settings
      const updateData: Record<string, unknown> = {
        school_type: schoolType,
        name: schoolDetails.name || school.name,
        district: schoolDetails.district,
        subcounty: schoolDetails.subcounty,
        parish: schoolDetails.parish,
        village: schoolDetails.address,
        primary_color: branding.primary_color,
        accent_color: branding.accent_color,
        logo_url: branding.logo_url || school?.logo_url || null,
        motto: schoolDetails.motto || null,
        phone: schoolDetails.phone || null,
        email: schoolDetails.email || null,
        uneb_center_number: schoolDetails.uneb_center_number || null,
        ownership: schoolDetails.ownership,
        feature_stage: featureStage,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        selected_subjects: JSON.stringify(selectedSubjects),
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
        logger.error("Update error:", error);
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
        logger.warn("Checklist upsert failed:", checklistError);
      }

      await Promise.all([
        (async () => {
          try {
            await Promise.all([
              saveSchoolSetting(school.id, "academic_year", currentYear),
              saveSchoolSetting(school.id, "current_term", "1"),
            ]);
          } catch (settingsError) {
            logger.warn("Save school settings failed:", settingsError);
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("classes")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school.id)
              .eq("academic_year", currentYear);

            if (!count) {
              const classData = buildDefaultClasses(
                school.id,
                schoolType,
                currentYear,
              );
              const { error: classError } = await supabase
                .from("classes")
                .insert(classData);
              if (classError) {
                const { error: upsertError } = await supabase
                  .from("classes")
                  .upsert(classData, {
                    onConflict: "school_id,name,academic_year",
                  });
                if (upsertError)
                  logger.error("Classes upsert error:", upsertError);
              }
            }
          } catch (err) {
            logger.warn("Classes seeding failed:", err);
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("academic_terms")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school.id)
              .eq("academic_year", currentYear);

            if (!count) {
              const termData = buildUgandaAcademicTerms(school.id, currentYear);
              const { error: termError } = await supabase
                .from("academic_terms")
                .insert(termData);
              if (termError) {
                const { error: upsertError } = await supabase
                  .from("academic_terms")
                  .upsert(termData, {
                    onConflict: "school_id,academic_year,term_number",
                  });
                if (upsertError)
                  logger.error("Terms upsert error:", upsertError);
              }
            }
          } catch (err) {
            logger.warn("Terms seeding failed:", err);
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("events")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school.id)
              .in("event_type", ["academic", "holiday"]);

            if (!count) {
              const { error: eventError } = await supabase
                .from("events")
                .insert(buildUgandaCalendarEvents(school.id, currentYear));
              if (eventError)
                logger.warn("Events seeding failed:", eventError);
            }
          } catch (err) {
            logger.warn("Events seeding failed:", err);
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("timetable_slots")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school.id);

            if (!count) {
              const { error: slotError } = await supabase
                .from("timetable_slots")
                .insert(buildDefaultTimetableSlots(school.id));
              if (slotError)
                logger.warn("Timetable slots seeding failed:", slotError);
            }
          } catch (err) {
            logger.warn("Timetable slots seeding failed:", err);
          }
        })(),
      ]);

      // Insert dorms if boarding was configured
      if (boardingConfig.hasBoarding) {
        try {
          const dormsData = boardingConfig.dormitories
            .filter((d) => d.name.trim())
            .map((d) => ({
              school_id: school.id,
              name: d.name.trim(),
              type: d.type,
              capacity: d.capacity,
            }));
          if (dormsData.length > 0) {
            const { error: dormsError } = await supabase
              .from("dorms")
              .insert(dormsData);
            if (dormsError) logger.warn("Dorms insert failed:", dormsError);
          }
        } catch (err) {
          logger.warn("Dorms insertion failed:", err);
        }
      }

      // Insert houses if configured
      if (boardingConfig.hasHouses) {
        try {
          const housesData = boardingConfig.houses
            .filter((h) => h.trim())
            .map((h) => ({
              school_id: school.id,
              name: h.trim(),
            }));
          if (housesData.length > 0) {
            const { error: housesError } = await supabase
              .from("houses")
              .insert(housesData);
            if (housesError) logger.warn("Houses insert failed:", housesError);
          }
        } catch (err) {
          logger.warn("Houses insertion failed:", err);
        }
      }

      await refreshSchool();
      setLoading(false);
      onComplete();
      toast.success(
        "Setup complete. Your school can start working immediately.",
      );
    } catch (error: unknown) {
      logger.error("Final error:", error);
      toast.error(
        getErrorMessage(error, "Failed to save your setup. Please try again."),
      );
      setLoading(false);
    }
  };

  const steps = [
    { title: "Welcome", icon: "waving_hand" },
    { title: "Essentials", icon: "domain" },
    { title: "Curriculum", icon: "auto_stories" },
    { title: "Boarding & Houses", icon: "hotel" },
    { title: "Features", icon: "widgets" },
    { title: "Launch", icon: "verified" },
  ];

  const selectedPlan = PLANS[normalizePlanType(school.subscription_plan)];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[var(--bg)]/90 backdrop-blur-xl overflow-y-auto md:overflow-hidden">
      <div
        className="relative flex w-full h-auto min-h-[100dvh] md:min-h-auto md:h-full md:max-h-[80vh] flex-col md:overflow-y-auto md:overflow-x-hidden py-6 md:py-0 md:rounded-[36px] bg-white shadow-[0_38px_90px_rgba(15,23,42,0.16)] ring-1 ring-black/5 md:flex-row"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Left Side: Progress & Info - Desktop only */}
        <div className="relative hidden md:flex md:w-1/3 md:min-h-[600px] flex-col overflow-hidden bg-[linear-gradient(160deg,#0b1c39_0%,#17325f_54%,#1a4b79_100%)] p-10 text-white">
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
        <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 pb-24 md:pb-12 relative min-h-[400px] md:min-h-[600px] w-full md:max-w-lg">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-start md:justify-center max-w-md"
              >
                <OwlStage
                  eyebrow="Launch setup"
                  title="Welcome to SkoolMate OS"
                  description="The owl will walk you through school essentials, curriculum defaults, feature activation, and launch settings in one clear flow."
                  chips={[
                    "School identity",
                    "Curriculum defaults",
                    "Launch-ready modules",
                  ]}
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
                className="flex-1 flex flex-col justify-start md:justify-center max-w-md"
              >
                <OwlStage
                  compact
                  eyebrow="School identity"
                  title="School branding"
                  description="Set the details staff and parents recognize immediately. These choices carry through receipts, report cards, and daily communication."
                  chips={[
                    "Official school name",
                    "Local area details",
                    "Primary theme color",
                  ]}
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

                  {/* School Motto */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      School Motto <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <Input
                      value={schoolDetails.motto}
                      onChange={(e) =>
                        setSchoolDetails({ ...schoolDetails, motto: e.target.value })
                      }
                      placeholder="For God and My Country"
                    />
                  </div>

                  {/* Ownership Type */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Ownership Type
                    </label>
                    <select
                      value={schoolDetails.ownership}
                      onChange={(e) =>
                        setSchoolDetails({ ...schoolDetails, ownership: e.target.value as "private" | "government" | "government_aided" })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                      <option value="private">Private</option>
                      <option value="government">Government</option>
                      <option value="government_aided">Government Aided</option>
                    </select>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      School Phone <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <Input
                      value={schoolDetails.phone}
                      onChange={(e) =>
                        setSchoolDetails({ ...schoolDetails, phone: e.target.value })
                      }
                      placeholder="0772 123456"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      School Email <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <Input
                      value={schoolDetails.email}
                      onChange={(e) =>
                        setSchoolDetails({ ...schoolDetails, email: e.target.value })
                      }
                      placeholder="admin@school.ug"
                    />
                  </div>

                  {/* UNEB Center Number */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      UNEB Center Number <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <Input
                      value={schoolDetails.uneb_center_number}
                      onChange={(e) =>
                        setSchoolDetails({ ...schoolDetails, uneb_center_number: e.target.value })
                      }
                      placeholder="U0012"
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
                          {
                            key: "primary",
                            label: "Primary",
                            icon: "child_care",
                            desc: "P.1 – P.7",
                          },
                          {
                            key: "secondary",
                            label: "Secondary",
                            icon: "school",
                            desc: "S.1 – S.6",
                          },
                          {
                            key: "combined",
                            label: "Combined",
                            icon: "account_balance",
                            desc: "P.1 – S.6",
                          },
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
                          <MaterialIcon
                            icon={opt.icon}
                            className="text-[22px]"
                          />
                          <span>{opt.label}</span>
                          <span className="font-normal text-[10px] opacity-70">
                            {opt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      School Logo <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      {branding.logo_url ? (
                        <Image
                          src={branding.logo_url}
                          alt="School logo"
                          width={64}
                          height={64}
                          className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                          <MaterialIcon icon="school" className="text-slate-400" />
                        </div>
                      )}
                      <label className="cursor-pointer rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                        {uploadingLogo ? "Uploading..." : "Choose file"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                      </label>
                      {branding.logo_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setBranding({ ...branding, logo_url: "" })
                          }
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Primary Color
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

                  {/* Accent Color */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Accent Color <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-4">
                      {[
                        "#3b82f6",
                        "#8b5cf6",
                        "#ec4899",
                        "#f59e0b",
                        "#10b981",
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            setBranding({ ...branding, accent_color: color })
                          }
                          className={`w-12 h-12 rounded-full border-[3px] transition-transform hover:scale-110 ${branding.accent_color === color ? "border-slate-800 ring-2 ring-offset-2 ring-slate-200" : "border-transparent"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          value={branding.accent_color}
                          onChange={(e) =>
                            setBranding({
                              ...branding,
                              accent_color: e.target.value,
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
                  We preload common Uganda district, division, and parish
                  options so school leaders can finish setup quickly even on
                  slow connections.
                </div>

                <div
                  className="flex gap-3 mt-auto pt-4 pb-8 md:pb-0 md:pt-0"
                  style={{
                    paddingBottom:
                      "max(2rem, env(safe-area-inset-bottom, 2rem))",
                  }}
                >
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
                className="flex-1 flex flex-col justify-start md:justify-center max-w-md"
              >
                <OwlStage
                  compact
                  eyebrow="Curriculum ready"
                  title="Choose your subjects"
                  description={`Select optional subjects for ${school.name}. Core subjects are already selected.`}
                  chips={[
                    schoolType === "primary"
                      ? "P.1 – P.7"
                      : schoolType === "secondary"
                        ? "S.1 – S.6"
                        : "P.1 – S.6",
                    "Customise your curriculum",
                  ]}
                  className="mb-6"
                />

                <div className="mb-8 rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] p-5 shadow-sm max-h-[360px] overflow-y-auto">
                  {/* Compulsory subjects - read-only */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">
                      Core Subjects
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {getTemplateForType(schoolType).subjects
                        .filter((s) => s.is_compulsory)
                        .map((subj) => (
                          <span
                            key={subj.code}
                            className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700"
                          >
                            <MaterialIcon
                              icon="check_circle"
                              className="text-teal-500 text-sm"
                            />
                            {subj.name}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Template optional subjects */}
                  {getTemplateForType(schoolType).subjects.filter((s) => !s.is_compulsory)
                    .length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">
                        Optional Subjects{" "}
                        <span className="text-slate-400 font-normal">
                          (toggle on/off)
                        </span>
                      </h4>
                      <div className="space-y-1.5">
                        {getTemplateForType(schoolType).subjects
                          .filter((s) => !s.is_compulsory)
                          .map((subj) => (
                            <label
                              key={subj.code}
                              className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 p-3 transition-all ${
                                selectedSubjects.includes(subj.name)
                                  ? "border-teal-400 bg-teal-50/50"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSubjects.includes(subj.name)}
                                onChange={() =>
                                  setSelectedSubjects((prev) =>
                                    prev.includes(subj.name)
                                      ? prev.filter((s) => s !== subj.name)
                                      : [...prev, subj.name],
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="text-sm font-medium text-slate-700">
                                {subj.name}
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Additional optional subjects */}
                  {ADDITIONAL_OPTIONAL_SUBJECTS.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">
                        More Subjects{" "}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </h4>
                      <div className="space-y-1.5">
                        {ADDITIONAL_OPTIONAL_SUBJECTS.map((subj) => (
                          <label
                            key={subj.code}
                            className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 p-3 transition-all ${
                              selectedSubjects.includes(subj.name)
                                ? "border-teal-400 bg-teal-50/50"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSubjects.includes(subj.name)}
                              onChange={() =>
                                setSelectedSubjects((prev) =>
                                  prev.includes(subj.name)
                                    ? prev.filter((s) => s !== subj.name)
                                    : [...prev, subj.name],
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm font-medium text-slate-700">
                              {subj.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="flex gap-3 mt-auto pt-4 pb-8 md:pb-0 md:pt-0"
                  style={{
                    paddingBottom:
                      "max(2rem, env(safe-area-inset-bottom, 2rem))",
                  }}
                >
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(4)}>
                    Next: Boarding
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-start md:justify-center max-w-md"
              >
                <OwlStage
                  compact
                  eyebrow="Accommodation"
                  title="Boarding & Houses"
                  description="Set up dormitories and sports houses so students can be assigned easily."
                  chips={["Dormitory setup", "Competition houses"]}
                  className="mb-6"
                />

                <div className="mb-8 rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] p-5 shadow-sm">
                  {/* Boarding toggle */}
                  <div className="mb-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={boardingConfig.hasBoarding}
                        onChange={() =>
                          setBoardingConfig((prev) => ({
                            ...prev,
                            hasBoarding: !prev.hasBoarding,
                          }))
                        }
                        className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        Does your school have boarding facilities?
                      </span>
                    </label>
                  </div>

                  {boardingConfig.hasBoarding && (
                    <>
                      {/* Dorm count */}
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Number of Dormitories
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={boardingConfig.dormCount}
                            onChange={(e) => {
                              const count = Number(e.target.value);
                              setBoardingConfig((prev) => ({
                                ...prev,
                                dormCount: count,
                                dormitories: Array.from(
                                  { length: count },
                                  (_, i) =>
                                    prev.dormitories[i] || {
                                      name: "",
                                      type: "boys" as const,
                                      capacity: 40,
                                    },
                                ),
                              }));
                            }}
                            className="flex-1 accent-teal-600"
                          />
                          <span className="text-sm font-semibold text-slate-700 w-6 text-center">
                            {boardingConfig.dormCount}
                          </span>
                        </div>
                      </div>

                      {/* Dorm names & type */}
                      <div className="space-y-3 mb-5">
                        {boardingConfig.dormitories
                          .slice(0, boardingConfig.dormCount)
                          .map((dorm, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2"
                            >
                              <input
                                placeholder={`Dormitory ${i + 1} name`}
                                value={dorm.name}
                                onChange={(e) =>
                                  setBoardingConfig((prev) => {
                                    const updated = [...prev.dormitories];
                                    updated[i] = {
                                      ...updated[i],
                                      name: e.target.value,
                                    };
                                    return { ...prev, dormitories: updated };
                                  })
                                }
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                              />
                              <select
                                value={dorm.type}
                                onChange={(e) =>
                                  setBoardingConfig((prev) => {
                                    const updated = [...prev.dormitories];
                                    updated[i] = {
                                      ...updated[i],
                                      type: e.target.value as "boys" | "girls",
                                    };
                                    return { ...prev, dormitories: updated };
                                  })
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                              >
                                <option value="boys">Boys</option>
                                <option value="girls">Girls</option>
                              </select>
                              <input
                                type="number"
                                min={1}
                                placeholder="Capacity"
                                value={dorm.capacity}
                                onChange={(e) =>
                                  setBoardingConfig((prev) => {
                                    const updated = [...prev.dormitories];
                                    updated[i] = {
                                      ...updated[i],
                                      capacity: Number(e.target.value),
                                    };
                                    return { ...prev, dormitories: updated };
                                  })
                                }
                                className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                              />
                            </div>
                          ))}
                      </div>

                      {/* Houses toggle */}
                      <div className="mb-4 pt-4 border-t border-slate-200">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                          <input
                            type="checkbox"
                            checked={boardingConfig.hasHouses}
                            onChange={() =>
                              setBoardingConfig((prev) => ({
                                ...prev,
                                hasHouses: !prev.hasHouses,
                              }))
                            }
                            className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm font-semibold text-slate-700">
                            Does your school have sports/competition houses?
                          </span>
                        </label>

                        {boardingConfig.hasHouses && (
                          <>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Number of Houses
                            </label>
                            <div className="flex items-center gap-3 mb-3">
                              <input
                                type="range"
                                min={1}
                                max={8}
                                value={boardingConfig.houseCount}
                                onChange={(e) => {
                                  const count = Number(e.target.value);
                                  setBoardingConfig((prev) => ({
                                    ...prev,
                                    houseCount: count,
                                    houses: Array.from(
                                      { length: count },
                                      (_, i) => prev.houses[i] || "",
                                    ),
                                  }));
                                }}
                                className="flex-1 accent-teal-600"
                              />
                              <span className="text-sm font-semibold text-slate-700 w-6 text-center">
                                {boardingConfig.houseCount}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {boardingConfig.houses
                                .slice(0, boardingConfig.houseCount)
                                .map((house, i) => (
                                  <input
                                    key={i}
                                    placeholder={`House ${i + 1} name`}
                                    value={house}
                                    onChange={(e) =>
                                      setBoardingConfig((prev) => {
                                        const updated = [...prev.houses];
                                        updated[i] = e.target.value;
                                        return {
                                          ...prev,
                                          houses: updated,
                                        };
                                      })
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                                  />
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div
                  className="flex gap-3 mt-auto pt-4 pb-8 md:pb-0 md:pt-0"
                  style={{
                    paddingBottom:
                      "max(2rem, env(safe-area-inset-bottom, 2rem))",
                  }}
                >
                  <Button variant="secondary" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(5)}>
                    Choose Features
                  </Button>
                </div>
              </motion.div>
            )}

            {/* NEW STEP: Feature Stage Selection */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-start md:justify-center max-w-md"
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
                      onClick={() => setFeatureStage(option.key as "core" | "academic" | "finance" | "full")}
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

                <div
                  className="flex gap-3 mt-auto pt-4 pb-8 md:pb-0 md:pt-0"
                  style={{
                    paddingBottom:
                      "max(2rem, env(safe-area-inset-bottom, 2rem))",
                  }}
                >
                  <Button variant="secondary" onClick={() => setStep(4)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(6)}>
                    Review & Launch
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-start md:justify-center w-full"
              >
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Launch Ready
                </h3>
                <p className="text-slate-500 mb-6">
                  Your school package, default calendar, and starter setup are
                  already in place so the team can begin working immediately.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800">
                        Chosen Package
                      </h4>
                      <MaterialIcon
                        icon="workspace_premium"
                        className="text-teal-600"
                      />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {selectedPlan.name}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      The school selected this package during registration.
                      Billing can be refined later in Subscription Settings.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800">
                        Calendar Ready
                      </h4>
                      <MaterialIcon
                        icon="calendar_month"
                        className="text-blue-600"
                      />
                    </div>
                    <p className="text-sm text-slate-500">
                      Uganda term dates and holiday windows are preloaded from
                      the latest published school calendar pattern. Headteachers
                      can tweak them later if a circular changes.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 mb-8">
                  <div className="flex items-start gap-3">
                    <MaterialIcon
                      icon="bolt"
                      className="text-amber-500 mt-0.5"
                    />
                    <div>
                      <p className="font-semibold text-slate-800 mb-1">
                        Rural-first setup
                      </p>
                      <p className="text-sm text-slate-500">
                        We keep the first-run flow short, preload local school
                        details, and avoid forcing payment or heavy setup before
                        staff can start using the system.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="flex gap-3 mt-auto pt-4 pb-8 md:pb-0 md:pt-0"
                  style={{
                    paddingBottom:
                      "max(2rem, env(safe-area-inset-bottom, 2rem))",
                  }}
                >
                  <Button variant="secondary" onClick={() => setStep(5)}>
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
