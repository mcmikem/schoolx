"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import MaterialIcon from "@/components/MaterialIcon";
import OwlStage from "@/components/brand/OwlStage";
import OwlMascot from "@/components/brand/OwlMascot";

import { PLANS, normalizePlanType } from "@/lib/payments/subscription-client";
import { getDistrictOptions, getParishOptions, getSubcountyOptions } from "@/lib/uganda-admin";
import { buildUgandaAcademicTerms, buildUgandaCalendarEvents } from "@/lib/uganda-school-calendar";
import {
  buildDefaultClasses,
  buildDefaultTimetableSlots,
  getDefaultClassTemplates,
  type SchoolSetupType,
} from "@/lib/school-setup";
import { saveSchoolSetting } from "@/lib/school-settings";
import { PRIMARY_TEMPLATE, SECONDARY_TEMPLATE, type TemplateSubject } from "@/lib/curriculum-templates";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/validation";
import { APP_NAME } from "@/lib/app-name";

interface StepConfig {
  title: string;
  icon: string;
}

interface HouseDraft {
  name: string;
  color: string;
}

interface FeeDraft {
  name: string;
  amount: string;
  category: string;
  class_id: string;
  term: 1 | 2 | 3;
}

interface FeeClassOption {
  id: string;
  name: string;
  stream?: string | null;
}

export default function OnboardingFlow({ onComplete, onDismiss }: { onComplete: () => void; onDismiss?: () => void }) {
  const { school, refreshSchool } = useAuth();
  const pathname = usePathname();
  const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const currentYear = new Date().getFullYear().toString();
  const schoolType = (school?.school_type as SchoolSetupType) || "primary";

  // School details
  const [branding, setBranding] = useState({
    primary_color: school?.primary_color || "#0d9488",
    accent_color: school?.accent_color || "#3b82f6",
    logo_url: school?.logo_url || "",
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState({
    name: school?.name || "",
    district: school?.district || "",
    subcounty: school?.subcounty || "",
    parish: school?.parish || "",
    motto: school?.motto || "",
    phone: school?.phone || "",
    email: school?.email || "",
    uneb_center_number:
      school?.uneb_center_number ||
      ((school as unknown as Record<string, unknown>)?.uneab_center_number as string) ||
      "",
    ownership: school?.ownership || "private",
    address: school?.address || "",
  });
  const [localSchoolType, setLocalSchoolType] = useState<SchoolSetupType>(schoolType);

  // Curriculum
  const getTemplateForType = (type: SchoolSetupType) => {
    if (type === "secondary") return SECONDARY_TEMPLATE;
    if (type === "combined")
      return {
        classes: [...PRIMARY_TEMPLATE.classes, ...SECONDARY_TEMPLATE.classes],
        subjects: [...PRIMARY_TEMPLATE.subjects, ...SECONDARY_TEMPLATE.subjects],
      };
    return PRIMARY_TEMPLATE;
  };
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() =>
    getTemplateForType(localSchoolType).subjects.map((s) => s.name),
  );
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const ADDITIONAL_OPTIONAL_SUBJECTS: { name: string; code: string }[] = [
    { name: "Music", code: "MUS" },
    { name: "Physical Education", code: "PE" },
    { name: "Islamic Studies", code: "ISL" },
    { name: "Arabic", code: "ARB" },
    { name: "French", code: "FRN" },
    { name: "Additional Mathematics", code: "ADM" },
    { name: "Home Economics", code: "HEC" },
  ];

  // Boarding
  const [boardingConfig, setBoardingConfig] = useState({
    hasBoarding: false,
    dormCount: 1,
    dormitories: [{ name: "", type: "boys" as "boys" | "girls", capacity: 40 }],
    hasHouses: false,
    houseCount: 1,
    houses: [{ name: "", color: "#3b82f6" }] as HouseDraft[],
  });

  // Academic Calendar
  const [terms, setTerms] = useState(
    buildUgandaAcademicTerms("preview", currentYear).map((term) => ({
      name: term.name,
      code: term.code,
      term_number: term.term_number,
      start: term.start_date,
      end: term.end_date,
    })),
  );

  // Fee Structure
  const [fees, setFees] = useState<FeeDraft[]>([
    {
      name: "Tuition",
      amount: "150000",
      category: "Tuition",
      class_id: "all",
      term: 1,
    },
    {
      name: "Development",
      amount: "50000",
      category: "Development",
      class_id: "all",
      term: 1,
    },
  ]);
  const [feeClassOptions, setFeeClassOptions] = useState<FeeClassOption[]>([]);

  // Grading
  const [gradingPrefs, setGradingPrefs] = useState({
    passing_mark: 50,
    grades: [
      { label: "A", min: 80, max: 100 },
      { label: "B", min: 70, max: 79 },
      { label: "C", min: 60, max: 69 },
      { label: "D", min: 50, max: 59 },
      { label: "E", min: 0, max: 49 },
    ],
  });

  // Report Card Branding
  const [reportBrand, setReportBrand] = useState({
    header: ((school as unknown as Record<string, unknown>)?.report_header_text as string) || "",
    footer: ((school as unknown as Record<string, unknown>)?.report_footer_text as string) || "",
    receipt_footer: ((school as unknown as Record<string, unknown>)?.receipt_footer_text as string) || "",
    show_position: (school as unknown as Record<string, unknown>)?.show_position_in_report !== false,
    show_conduct: (school as unknown as Record<string, unknown>)?.show_conduct_in_report !== false,
    show_attendance: (school as unknown as Record<string, unknown>)?.show_attendance_in_report !== false,
    show_remarks: (school as unknown as Record<string, unknown>)?.show_remarks_in_report !== false,
  });

  // Features
  const [featureStage, setFeatureStage] = useState<"core" | "academic" | "finance" | "full">(
    (school?.feature_stage as "core" | "academic" | "finance" | "full") || "core",
  );

  const selectedPlan = PLANS[normalizePlanType(school?.subscription_plan || "free")];

  // Steps config
  const steps: StepConfig[] = [
    { title: "School & Subjects", icon: "auto_stories" },
    { title: "Calendar & Fees", icon: "payments" },
    { title: "Grading & Reports", icon: "badge" },
    { title: "Boarding & Features", icon: "widgets" },
    { title: "Launch", icon: "verified" },
  ];

  const TOTAL_STEPS = steps.length;

  // Sync subjects when school type changes
  useEffect(() => {
    const defaults = getTemplateForType(localSchoolType).subjects.map((s) => s.name);
    setSelectedSubjects(Array.from(new Set([...defaults, ...customSubjects])));
  }, [localSchoolType, customSubjects]);

  const addCustomSubject = () => {
    const name = customSubjectInput.trim();
    if (!name) return;

    const alreadyExists = selectedSubjects.some((s) => s.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      setCustomSubjectInput("");
      return;
    }

    setCustomSubjects((prev) => [...prev, name]);
    setSelectedSubjects((prev) => [...prev, name]);
    setCustomSubjectInput("");
  };

  // Sync terms when school ID changes
  useEffect(() => {
    if (school?.id) {
      setTerms(
        buildUgandaAcademicTerms(school.id, currentYear).map((term) => ({
          name: term.name,
          code: term.code,
          term_number: term.term_number,
          start: term.start_date,
          end: term.end_date,
        })),
      );
    }
  }, [school?.id, currentYear]);

  // Keep page behind the wizard from scrolling while preserving wizard-internal scrolling.
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const markStepComplete = useCallback((stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepNum);
      return next;
    });
  }, []);

  const ensureFeeClassOptions = useCallback(async (): Promise<FeeClassOption[]> => {
    if (!school?.id) return [];

    const academicYear = new Date().getFullYear().toString();
    const fetchClasses = async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name, stream")
        .eq("school_id", school.id)
        .eq("academic_year", academicYear)
        .order("name", { ascending: true });
      return (data || []) as FeeClassOption[];
    };

    let classesForFees = await fetchClasses();
    if (classesForFees.length === 0) {
      const defaults = buildDefaultClasses(school.id, localSchoolType, academicYear);
      await supabase.from("classes").upsert(defaults, {
        onConflict: "school_id,name,academic_year",
      });
      classesForFees = await fetchClasses();
    }

    setFeeClassOptions(classesForFees);
    return classesForFees;
  }, [school?.id, localSchoolType]);

  const buildFeeRows = useCallback(
    (classOptions: FeeClassOption[]) => {
      const schoolId = school?.id;
      if (!schoolId) return [];

      const year = new Date().getFullYear().toString();
      const rows: Array<{
        school_id: string;
        name: string;
        amount: number;
        category: string;
        class_id: string | null;
        term: 1 | 2 | 3;
        academic_year: string;
      }> = [];

      fees
        .filter((fee) => fee.name && parseFloat(fee.amount) > 0)
        .forEach((fee) => {
          if (fee.class_id === "all") {
            if (classOptions.length > 0) {
              classOptions.forEach((classOption) => {
                rows.push({
                  school_id: schoolId,
                  name: fee.name,
                  amount: parseFloat(fee.amount),
                  category: fee.category,
                  class_id: classOption.id,
                  term: fee.term,
                  academic_year: year,
                });
              });
            } else {
              rows.push({
                school_id: schoolId,
                name: fee.name,
                amount: parseFloat(fee.amount),
                category: fee.category,
                class_id: null,
                term: fee.term,
                academic_year: year,
              });
            }
            return;
          }

          rows.push({
            school_id: schoolId,
            name: fee.name,
            amount: parseFloat(fee.amount),
            category: fee.category,
            class_id: fee.class_id,
            term: fee.term,
            academic_year: year,
          });
        });

      return rows;
    },
    [fees, school?.id],
  );

  useEffect(() => {
    if (step === 2 && school?.id) {
      void ensureFeeClassOptions();
    }
  }, [step, school?.id, ensureFeeClassOptions]);

  const compressImage = (file: File, maxW: number, maxH: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width,
          h = img.height;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        if (h > maxH) {
          w = (w * maxH) / h;
          h = maxH;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  };

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
      const { data: urlData } = supabase.storage.from("school-logos").getPublicUrl(filePath);
      const logoUrl = urlData?.publicUrl;
      if (logoUrl) {
        setBranding((prev) => ({ ...prev, logo_url: logoUrl }));
        const { error: updateError } = await supabase.from("schools").update({ logo_url: logoUrl }).eq("id", school.id);
        if (updateError) {
          logger.warn("Failed to save logo URL:", updateError);
          toast.error("Logo uploaded but failed to save. Please try again.");
        } else {
          toast.success("Logo uploaded");
        }
      }
    } catch (err) {
      logger.error("Logo upload failed:", err);
      toast.error("Failed to upload logo. You can add it later in settings.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save terms
  const saveTerms = async (): Promise<boolean> => {
    if (!school?.id) return false;
    setSaving(true);
    try {
      const termRows = terms
        .filter((term) => term.start && term.end)
        .map((term) => ({
          school_id: school.id,
          name: term.name,
          code: term.code || `T${term.term_number}-${new Date().getFullYear()}`,
          term_number: term.term_number || 0,
          start_date: term.start,
          end_date: term.end,
          academic_year: new Date().getFullYear().toString(),
          is_current: false,
        }));

      if (termRows.length > 0) {
        const { error } = await supabase.from("academic_terms").upsert(termRows, {
          onConflict: "school_id,term_number,academic_year",
        });
        if (error) throw error;
      }

      toast.success("Academic calendar saved");
      return true;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save terms"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save fees
  const saveFees = async (): Promise<boolean> => {
    if (!school?.id) return false;
    setSaving(true);
    try {
      const classOptions = await ensureFeeClassOptions();
      const feeRows = buildFeeRows(classOptions);

      if (feeRows.length > 0) {
        const { error: insertError } = await supabase.from("fee_structure").upsert(feeRows, {
          onConflict: "school_id,class_id,name,term,academic_year",
        });
        if (insertError) throw insertError;
      }

      toast.success("Fee structure saved");
      return true;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save fees"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save grading
  const saveGradingPrefs = async (): Promise<boolean> => {
    if (!school?.id) return false;
    setSaving(true);
    try {
      const { error: pmError } = await supabase
        .from("school_settings")
        .upsert(
          { school_id: school.id, key: "passing_mark", value: String(gradingPrefs.passing_mark) },
          { onConflict: "school_id,key" },
        );
      if (pmError) throw pmError;

      const { error: gradesError } = await supabase
        .from("school_settings")
        .upsert(
          { school_id: school.id, key: "grade_labels", value: JSON.stringify(gradingPrefs.grades) },
          { onConflict: "school_id,key" },
        );
      if (gradesError) throw gradesError;

      toast.success("Grading system saved");
      return true;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save grading preferences"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save report branding
  const saveReportBranding = async (): Promise<boolean> => {
    if (!school?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          report_header_text: reportBrand.header || null,
          report_footer_text: reportBrand.footer || null,
          receipt_footer_text: reportBrand.receipt_footer || null,
          show_position_in_report: reportBrand.show_position,
          show_conduct_in_report: reportBrand.show_conduct,
          show_attendance_in_report: reportBrand.show_attendance,
          show_remarks_in_report: reportBrand.show_remarks,
        })
        .eq("id", school.id);
      if (error) throw error;
      toast.success("Report card settings saved");
      return true;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save report card settings"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Final complete handler
  const handleComplete = async () => {
    setLoading(true);
    const failedSeeding: string[] = [];
    try {
      const completionTimestamp = new Date().toISOString();
      const baseUpdateData: Record<string, unknown> = {
        school_type: localSchoolType,
        name: schoolDetails.name || school?.name || "",
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
        selected_subjects: JSON.stringify(selectedSubjects),
        setup_progress: JSON.stringify({
          completed: ["branding", "features", "activation"],
          skipped: [],
        }),
      };

      const completionVariants: Record<string, unknown>[] = [
        {
          onboarding_completed: true,
          onboarding_completed_at: completionTimestamp,
        },
        {
          onboarding_complete: true,
          onboarding_completed_at: completionTimestamp,
        },
        {
          onboarding_complete: true,
        },
        {},
      ];

      let updateError: { code?: string } | null = null;
      for (const completionData of completionVariants) {
        const { error } = await supabase
          .from("schools")
          .update({ ...baseUpdateData, ...completionData })
          .eq("id", school!.id);

        if (!error) {
          updateError = null;
          break;
        }

        updateError = error;
        if (error.code !== "42703") {
          throw error;
        }
      }

      if (updateError) {
        throw updateError;
      }

      // Save per-step data that might have been skipped
      await Promise.all([
        !completedSteps.has(2)
          ? (async () => {
              try {
                const classOptions = await ensureFeeClassOptions();
                const feeRows = buildFeeRows(classOptions);
                if (feeRows.length > 0) {
                  const { error: fErr } = await supabase.from("fee_structure").upsert(feeRows, {
                    onConflict: "school_id,class_id,name,term,academic_year",
                  });
                  if (fErr) logger.warn("Auto-save fees failed:", fErr);
                }
                const termRows = terms
                  .filter((t) => t.start && t.end)
                  .map((term) => ({
                    school_id: school!.id,
                    name: term.name,
                    code: term.code || `T${term.term_number}-${new Date().getFullYear()}`,
                    term_number: term.term_number || 0,
                    start_date: term.start,
                    end_date: term.end,
                    academic_year: new Date().getFullYear().toString(),
                    is_current: false,
                  }));
                if (termRows.length > 0) {
                  const { error: tErr } = await supabase.from("academic_terms").upsert(termRows, {
                    onConflict: "school_id,term_number,academic_year",
                  });
                  if (tErr) logger.warn("Auto-save terms failed:", tErr);
                }
              } catch (e) {
                logger.warn("Auto-save calendar/fees error:", e);
              }
            })()
          : Promise.resolve(),
        !completedSteps.has(3)
          ? (async () => {
              try {
                await supabase
                  .from("school_settings")
                  .upsert(
                    { school_id: school!.id, key: "passing_mark", value: String(gradingPrefs.passing_mark) },
                    { onConflict: "school_id,key" },
                  );
                await supabase
                  .from("school_settings")
                  .upsert(
                    { school_id: school!.id, key: "grade_labels", value: JSON.stringify(gradingPrefs.grades) },
                    { onConflict: "school_id,key" },
                  );
                await supabase
                  .from("schools")
                  .update({
                    report_header_text: reportBrand.header || null,
                    report_footer_text: reportBrand.footer || null,
                    receipt_footer_text: reportBrand.receipt_footer || null,
                    show_position_in_report: reportBrand.show_position,
                    show_conduct_in_report: reportBrand.show_conduct,
                    show_attendance_in_report: reportBrand.show_attendance,
                    show_remarks_in_report: reportBrand.show_remarks,
                  })
                  .eq("id", school!.id);
              } catch (e) {
                logger.warn("Auto-save grading/reports error:", e);
              }
            })()
          : Promise.resolve(),
      ]);

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

      const { error: checklistError } = await supabase.from("setup_checklist").upsert(
        checklistItems.map((item) => ({ ...item, school_id: school!.id })),
        { onConflict: "school_id,item_key" },
      );

      if (checklistError) {
        logger.warn("Checklist upsert failed:", checklistError);
      }

      await Promise.all([
        (async () => {
          try {
            await Promise.all([
              saveSchoolSetting(school!.id, "academic_year", currentYear),
              saveSchoolSetting(school!.id, "current_term", "1"),
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
              .eq("school_id", school!.id)
              .eq("academic_year", currentYear);

            if (!count) {
              const classData = buildDefaultClasses(school!.id, localSchoolType, currentYear);
              const { error: classError } = await supabase.from("classes").insert(classData);
              if (classError) {
                const { error: upsertError } = await supabase.from("classes").upsert(classData, {
                  onConflict: "school_id,name,academic_year",
                });
                if (upsertError) {
                  logger.error("Classes upsert error:", upsertError);
                  failedSeeding.push("Classes");
                }
              }
            }
          } catch (err) {
            logger.warn("Classes seeding failed:", err);
            failedSeeding.push("Classes");
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("academic_terms")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school!.id)
              .eq("academic_year", currentYear);

            if (!count) {
              const termData = buildUgandaAcademicTerms(school!.id, currentYear);
              const { error: termError } = await supabase.from("academic_terms").insert(termData);
              if (termError) {
                const { error: upsertError } = await supabase.from("academic_terms").upsert(termData, {
                  onConflict: "school_id,academic_year,term_number",
                });
                if (upsertError) {
                  logger.error("Terms upsert error:", upsertError);
                  failedSeeding.push("Academic Terms");
                }
              }
            }
          } catch (err) {
            logger.warn("Terms seeding failed:", err);
            failedSeeding.push("Academic Terms");
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("events")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school!.id)
              .in("event_type", ["academic", "holiday"]);

            if (!count) {
              const { error: eventError } = await supabase
                .from("events")
                .insert(buildUgandaCalendarEvents(school!.id, currentYear));
              if (eventError) {
                logger.warn("Events seeding failed:", eventError);
                failedSeeding.push("Calendar Events");
              }
            }
          } catch (err) {
            logger.warn("Events seeding failed:", err);
            failedSeeding.push("Calendar Events");
          }
        })(),
        (async () => {
          try {
            const { count } = await supabase
              .from("timetable_slots")
              .select("id", { count: "exact", head: true })
              .eq("school_id", school!.id);

            if (!count) {
              const { error: slotError } = await supabase
                .from("timetable_slots")
                .insert(buildDefaultTimetableSlots(school!.id));
              if (slotError) {
                logger.warn("Timetable slots seeding failed:", slotError);
                failedSeeding.push("Timetable Slots");
              }
            }
          } catch (err) {
            logger.warn("Timetable slots seeding failed:", err);
            failedSeeding.push("Timetable Slots");
          }
        })(),
      ]);

      // Insert selected subjects if none exist yet.
      try {
        const { count } = await supabase
          .from("subjects")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school!.id);

        if (!count) {
          const templateSubjects = getTemplateForType(localSchoolType).subjects;
          const additionalMap = new Map(ADDITIONAL_OPTIONAL_SUBJECTS.map((s) => [s.name.toLowerCase(), s]));
          const templateMap = new Map(templateSubjects.map((s) => [s.name.toLowerCase(), s]));

          const selectedRows: TemplateSubject[] = selectedSubjects.map((name) => {
            const key = name.toLowerCase();
            const fromTemplate = templateMap.get(key);
            if (fromTemplate) return fromTemplate;

            const fromAdditional = additionalMap.get(key);
            if (fromAdditional) {
              return {
                name: fromAdditional.name,
                code: fromAdditional.code,
                level: localSchoolType === "combined" ? "both" : localSchoolType,
                is_compulsory: false,
              };
            }

            const compact = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
            const code = (compact.slice(0, 4) || "SUBJ").padEnd(3, "X");
            return {
              name,
              code,
              level: localSchoolType === "combined" ? "both" : localSchoolType,
              is_compulsory: false,
            };
          });

          const uniqueRows = Array.from(new Map(selectedRows.map((row) => [row.name.toLowerCase(), row])).values());

          if (uniqueRows.length > 0) {
            const { error: subjectsError } = await supabase.from("subjects").insert(
              uniqueRows.map((row) => ({
                school_id: school!.id,
                name: row.name,
                code: row.code,
                level: row.level,
                is_compulsory: row.is_compulsory,
              })),
            );
            if (subjectsError) {
              logger.warn("Subjects insert failed:", subjectsError);
              failedSeeding.push("Subjects");
            }
          }
        }
      } catch (err) {
        logger.warn("Subjects seeding failed:", err);
        failedSeeding.push("Subjects");
      }

      // Insert dorms if boarding was configured
      if (boardingConfig.hasBoarding) {
        try {
          const dormsData = boardingConfig.dormitories
            .filter((d) => d.name.trim())
            .map((d) => ({
              school_id: school!.id,
              name: d.name.trim(),
              type: d.type,
              capacity: d.capacity,
            }));
          if (dormsData.length > 0) {
            const { error: dormsError } = await supabase.from("dorms").insert(dormsData);
            if (dormsError) {
              logger.warn("Dorms insert failed:", dormsError);
              failedSeeding.push("Dormitories");
            }
          }
        } catch (err) {
          logger.warn("Dorms insertion failed:", err);
          failedSeeding.push("Dormitories");
        }
      }

      // Insert houses if configured
      if (boardingConfig.hasHouses) {
        try {
          const housesData = boardingConfig.houses
            .filter((h) => h.name.trim())
            .map((h) => ({
              school_id: school!.id,
              name: h.name.trim(),
              color: h.color || null,
            }));
          if (housesData.length > 0) {
            const { error: housesError } = await supabase.from("houses").insert(housesData);
            if (housesError) {
              logger.warn("Houses insert failed:", housesError);
              failedSeeding.push("Houses");
            }
          }
        } catch (err) {
          logger.warn("Houses insertion failed:", err);
          failedSeeding.push("Houses");
        }
      }

      await refreshSchool();
      setLoading(false);
      onComplete();
      if (failedSeeding.length > 0) {
        toast.warning(
          `Setup complete, but these items failed to seed and can be added later: ${failedSeeding.join(", ")}`,
        );
      } else {
        toast.success("Setup complete. Your school can start working immediately.");
      }
    } catch (error: unknown) {
      logger.error("Final error:", error);
      toast.error(getErrorMessage(error, "Failed to save your setup. Please try again."));
      setLoading(false);
    }
  };

  const handleNext = (nextStep: number) => {
    markStepComplete(step);
    setStep(nextStep);
  };

  const handleBack = (prevStep: number) => {
    setStep(prevStep);
  };

  const handleGenericNext = async () => {
    if (step === 2) {
      if (await saveTerms()) {
        markStepComplete(2);
        await saveFees();
        handleNext(3);
      }
    } else if (step === 3) {
      if (await saveGradingPrefs()) {
        markStepComplete(3);
        await saveReportBranding();
        handleNext(4);
      }
    } else {
      handleNext(step + 1);
    }
  };

  if (!school) return null;

  const progressPercent = Math.round((completedSteps.size / TOTAL_STEPS) * 100);

  if (
    currentPath.startsWith("/dashboard/fees") ||
    currentPath.startsWith("/dashboard/billing") ||
    currentPath.startsWith("/dashboard/pricing") ||
    currentPath.startsWith("/dashboard/settings") ||
    currentPath.startsWith("/dashboard/payment-plans")
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-white md:overflow-hidden md:bg-[var(--bg)]/90 md:backdrop-blur-xl md:items-center md:justify-center">
      {/* Mobile header with progress */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
        <button
          onClick={() => {
            if (step > 1) handleBack(step - 1);
            else (onDismiss ?? onComplete)();
          }}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
          aria-label="Go back"
        >
          <MaterialIcon icon="arrow_back" className="text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">
              Step {step} of {TOTAL_STEPS}
            </span>
            <span className="text-xs font-semibold text-teal-600">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <button
          onClick={onDismiss ?? onComplete}
          className="p-2 -mr-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
          aria-label="Close onboarding"
        >
          <MaterialIcon icon="close" className="text-slate-400" />
        </button>
      </div>

      {/* Mobile step dots */}
      <div className="md:hidden flex items-center justify-center gap-1.5 py-2 bg-white border-b border-slate-100">
        {steps.map((s, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === step;
          const isPassed = completedSteps.has(stepNum) || stepNum < step;
          return (
            <button
              key={idx}
              onClick={() => {
                if (stepNum < step || completedSteps.has(stepNum)) {
                  setStep(stepNum);
                }
              }}
              className={`rounded-full transition-all duration-200 ${
                isActive ? "w-6 h-2 bg-teal-500" : isPassed ? "w-2 h-2 bg-teal-300" : "w-2 h-2 bg-slate-200"
              }`}
              aria-label={`Go to step ${stepNum}: ${s.title}`}
            />
          );
        })}
      </div>

      <div className="relative flex w-full h-full min-h-0 md:h-auto md:max-h-[80vh] md:min-h-0 flex-col md:flex-row md:overflow-hidden md:rounded-[36px] md:shadow-[0_38px_90px_rgba(15,23,42,0.16)] md:ring-1 md:ring-black/5">
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
                const isPassed = completedSteps.has(stepNum) || stepNum < step;

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
                        <MaterialIcon icon="check" className="text-white text-lg" />
                      ) : (
                        <MaterialIcon
                          icon={s.icon}
                          className={`text-lg ${isActive ? "text-white" : "text-white/50"}`}
                        />
                      )}
                    </div>
                    <span className={`font-medium ${isActive ? "text-white text-lg" : "text-white/70"}`}>
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Step Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-8 lg:p-12">
            <div className="animate-fade-in w-full">
              {/* Step 1: School & Subjects (Welcome + School Info + Curriculum) */}
              {step === 1 && (
                <div className="flex-1 flex flex-col max-w-lg mx-auto">
                  <OwlStage
                    eyebrow="Welcome"
                    title={`Set up ${APP_NAME}`}
                    description="We will guide you through the essentials. Most schools finish in 5-10 minutes, and you can update anything later."
                    chips={["School profile & subjects", "Calendar & fee structure", "Grading & report cards"]}
                    className="mb-6"
                  />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 mb-6">
                    <p className="font-semibold text-slate-900">Need a guided setup call?</p>
                    <p className="mt-1">
                      If this feels too technical, our team can help you complete setup by phone or WhatsApp.
                    </p>
                  </div>

                  <hr className="border-slate-200 mb-6" />
                  <h3 className="text-lg font-bold text-slate-800 mb-4">School Details</h3>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">School Name</label>
                      <Input
                        value={schoolDetails.name}
                        onChange={(e) => setSchoolDetails({ ...schoolDetails, name: e.target.value })}
                        placeholder="St. Mary&apos;s Primary School"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        School Motto <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <Input
                        value={schoolDetails.motto}
                        onChange={(e) => setSchoolDetails({ ...schoolDetails, motto: e.target.value })}
                        placeholder="For God and My Country"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Ownership Type</label>
                      <select
                        value={schoolDetails.ownership}
                        onChange={(e) =>
                          setSchoolDetails({
                            ...schoolDetails,
                            ownership: e.target.value as "private" | "government" | "government_aided",
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      >
                        <option value="private">Private</option>
                        <option value="government">Government</option>
                        <option value="government_aided">Government Aided</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        School Phone <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <Input
                        value={schoolDetails.phone}
                        onChange={(e) => setSchoolDetails({ ...schoolDetails, phone: e.target.value })}
                        placeholder="0772 123456"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        School Email <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <Input
                        value={schoolDetails.email}
                        onChange={(e) => setSchoolDetails({ ...schoolDetails, email: e.target.value })}
                        placeholder="admin@school.ug"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        UNEB Center Number <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <Input
                        value={schoolDetails.uneb_center_number}
                        onChange={(e) => setSchoolDetails({ ...schoolDetails, uneb_center_number: e.target.value })}
                        placeholder="U0012"
                      />
                    </div>

                    <Select
                      label="District"
                      options={[{ value: "", label: "Select district" }, ...getDistrictOptions()]}
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
                        ...getParishOptions(schoolDetails.district, schoolDetails.subcounty),
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
                      <label className="block text-sm font-semibold text-slate-700 mb-2">School Type</label>
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
                            onClick={() => setLocalSchoolType(opt.key)}
                            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-semibold transition-all ${
                              localSchoolType === opt.key
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
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
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
                            onClick={() => setBranding({ ...branding, logo_url: "" })}
                            className="text-sm text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Primary Color</label>
                      <div className="flex gap-3 flex-wrap">
                        {["#0d9488", "#2563eb", "#0f172a", "#16a34a", "#dc2626"].map((color) => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, primary_color: color })}
                            className={`w-10 h-10 rounded-full border-[3px] transition-transform hover:scale-110 ${
                              branding.primary_color === color
                                ? "border-slate-800 ring-2 ring-offset-2 ring-slate-200"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <div className="relative">
                          <input
                            type="color"
                            value={branding.primary_color}
                            onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                          <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                            <MaterialIcon icon="add" className="text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Accent Color <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <div className="flex gap-3 flex-wrap">
                        {["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"].map((color) => (
                          <button
                            key={color}
                            onClick={() => setBranding({ ...branding, accent_color: color })}
                            className={`w-10 h-10 rounded-full border-[3px] transition-transform hover:scale-110 ${
                              branding.accent_color === color
                                ? "border-slate-800 ring-2 ring-offset-2 ring-slate-200"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <div className="relative">
                          <input
                            type="color"
                            value={branding.accent_color}
                            onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                          <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                            <MaterialIcon icon="add" className="text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 mb-6">
                    We preload common Uganda district, division, and parish options so school leaders can finish setup
                    quickly even on slow connections.
                  </div>

                  <hr className="border-slate-200 mb-6" />
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Curriculum & Subjects</h3>

                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm max-h-[50vh] overflow-y-auto">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Core Subjects</h4>
                      <div className="flex flex-wrap gap-2">
                        {getTemplateForType(localSchoolType)
                          .subjects.filter((s) => s.is_compulsory)
                          .map((subj, idx) => (
                            <span
                              key={`core-${subj.code}-${subj.name}-${idx}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700"
                            >
                              <MaterialIcon icon="check_circle" className="text-teal-500 text-sm" />
                              {subj.name}
                            </span>
                          ))}
                      </div>
                    </div>

                    {getTemplateForType(localSchoolType).subjects.filter((s) => !s.is_compulsory).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">
                          Optional Subjects <span className="text-slate-400 font-normal">(toggle on/off)</span>
                        </h4>
                        <div className="space-y-1.5">
                          {getTemplateForType(localSchoolType)
                            .subjects.filter((s) => !s.is_compulsory)
                            .map((subj, idx) => (
                              <label
                                key={`optional-${subj.code}-${subj.name}-${idx}`}
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
                                <span className="text-sm font-medium text-slate-700">{subj.name}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}

                    {ADDITIONAL_OPTIONAL_SUBJECTS.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">
                          More Subjects <span className="text-slate-400 font-normal">(optional)</span>
                        </h4>
                        <div className="space-y-1.5">
                          {ADDITIONAL_OPTIONAL_SUBJECTS.map((subj, idx) => (
                            <label
                              key={`extra-${subj.code}-${subj.name}-${idx}`}
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
                              <span className="text-sm font-medium text-slate-700">{subj.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Custom Subject</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSubjectInput}
                          onChange={(e) => setCustomSubjectInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomSubject();
                            }
                          }}
                          placeholder="e.g. Luganda"
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                        />
                        <Button type="button" size="sm" onClick={addCustomSubject}>
                          Add
                        </Button>
                      </div>
                      {customSubjects.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {customSubjects.map((subject) => (
                            <button
                              key={subject}
                              type="button"
                              onClick={() => {
                                setCustomSubjects((prev) => prev.filter((s) => s !== subject));
                                setSelectedSubjects((prev) => prev.filter((s) => s !== subject));
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
                            >
                              {subject}
                              <MaterialIcon icon="close" className="text-[14px]" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Calendar & Fees */}
              {step === 2 && (
                <div className="flex-1 flex flex-col max-w-lg mx-auto">
                  <OwlStage
                    compact
                    eyebrow="Academic Calendar & Fees"
                    title="Set term dates and fees"
                    description="Uganda term dates are preloaded. Adjust them and define your fee structure."
                    chips={["3 terms per year", "Per-term billing"]}
                    className="mb-6"
                  />

                  <hr className="border-slate-200 mb-6" />
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Term Dates</h3>

                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm space-y-3">
                    {terms.map((term, i) => (
                      <div key={i} className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-700 mb-2">{term.name}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Start Date</label>
                            <input
                              type="date"
                              value={term.start}
                              onChange={(e) => {
                                const newTerms = [...terms];
                                newTerms[i].start = e.target.value;
                                setTerms(newTerms);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">End Date</label>
                            <input
                              type="date"
                              value={term.end}
                              onChange={(e) => {
                                const newTerms = [...terms];
                                newTerms[i].end = e.target.value;
                                setTerms(newTerms);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <hr className="border-slate-200 mb-6" />
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Fee Structure</h3>

                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm space-y-3">
                    <p className="text-xs font-medium text-slate-500">
                      Assign each fee to a specific class or all classes.
                    </p>

                    {fees.map((fee, i) => (
                      <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={fee.name}
                            onChange={(e) => {
                              const newFees = [...fees];
                              newFees[i].name = e.target.value;
                              setFees(newFees);
                            }}
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            placeholder="Fee name"
                          />
                          <input
                            type="number"
                            value={fee.amount}
                            onChange={(e) => {
                              const newFees = [...fees];
                              newFees[i].amount = e.target.value;
                              setFees(newFees);
                            }}
                            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            placeholder="UGX"
                          />
                        </div>
                        <select
                          value={fee.category}
                          onChange={(e) => {
                            const newFees = [...fees];
                            newFees[i].category = e.target.value;
                            setFees(newFees);
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                        >
                          <option value="Tuition">Tuition</option>
                          <option value="Development">Development</option>
                          <option value="PTA">PTA</option>
                          <option value="Lunch">Lunch</option>
                          <option value="Transport">Transport</option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={fee.class_id}
                            onChange={(e) => {
                              const newFees = [...fees];
                              newFees[i].class_id = e.target.value;
                              setFees(newFees);
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                          >
                            <option value="all">All classes</option>
                            {feeClassOptions.map((classOption) => (
                              <option key={classOption.id} value={classOption.id}>
                                {classOption.name}
                                {classOption.stream ? ` ${classOption.stream}` : ""}
                              </option>
                            ))}
                          </select>
                          <select
                            value={fee.term}
                            onChange={(e) => {
                              const newFees = [...fees];
                              newFees[i].term = Number(e.target.value) as 1 | 2 | 3;
                              setFees(newFees);
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                          >
                            <option value={1}>Term 1</option>
                            <option value={2}>Term 2</option>
                            <option value={3}>Term 3</option>
                          </select>
                        </div>
                        {fees.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFees(fees.filter((_, idx) => idx !== i))}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setFees([
                          ...fees,
                          {
                            name: "",
                            amount: "",
                            category: "Tuition",
                            class_id: "all",
                            term: 1,
                          },
                        ])
                      }
                      className="w-full"
                      icon={<MaterialIcon icon="add" className="text-sm" />}
                    >
                      Add Fee
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Grading & Reports */}
              {step === 3 && (
                <div className="flex-1 flex flex-col max-w-lg mx-auto">
                  <OwlStage
                    compact
                    eyebrow="Grading & Reports"
                    title="Set grading and report card preferences"
                    description="Define the passing mark, grade ranges, and report card branding."
                    chips={["A–E grades", "Customizable ranges"]}
                    className="mb-6"
                  />

                  <hr className="border-slate-200 mb-6" />
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Grading System</h3>

                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm space-y-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">Passing Mark (%)</label>
                      <input
                        type="number"
                        value={gradingPrefs.passing_mark}
                        onChange={(e) =>
                          setGradingPrefs({ ...gradingPrefs, passing_mark: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                        min={0}
                        max={100}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">
                        Grade Labels & Score Ranges
                      </label>
                      {gradingPrefs.grades.map((g, i) => (
                        <div key={g.label} className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-bold w-8 text-center">{g.label}</span>
                          <input
                            type="number"
                            value={g.min}
                            onChange={(e) => {
                              const newGrades = [...gradingPrefs.grades];
                              newGrades[i].min = parseInt(e.target.value) || 0;
                              setGradingPrefs({ ...gradingPrefs, grades: newGrades });
                            }}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            placeholder="Min"
                          />
                          <span className="text-xs text-slate-400">to</span>
                          <input
                            type="number"
                            value={g.max}
                            onChange={(e) => {
                              const newGrades = [...gradingPrefs.grades];
                              newGrades[i].max = parseInt(e.target.value) || 0;
                              setGradingPrefs({ ...gradingPrefs, grades: newGrades });
                            }}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            placeholder="Max"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-slate-200 mb-6" />
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Report Card Branding</h3>

                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Report Header Text</label>
                      <input
                        type="text"
                        value={reportBrand.header}
                        onChange={(e) => setReportBrand({ ...reportBrand, header: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                        placeholder="Annual Academic Report"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Report Footer Text</label>
                      <input
                        type="text"
                        value={reportBrand.footer}
                        onChange={(e) => setReportBrand({ ...reportBrand, footer: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                        placeholder="Education is the key to success"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Receipt Footer Text</label>
                      <input
                        type="text"
                        value={reportBrand.receipt_footer}
                        onChange={(e) => setReportBrand({ ...reportBrand, receipt_footer: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                        placeholder="Thank you for your payment"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {[
                        { key: "show_position", label: "Show Position" },
                        { key: "show_conduct", label: "Show Conduct" },
                        { key: "show_attendance", label: "Show Attendance" },
                        { key: "show_remarks", label: "Show Remarks" },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={reportBrand[item.key as keyof typeof reportBrand] as boolean}
                            onChange={() =>
                              setReportBrand({
                                ...reportBrand,
                                [item.key]: !reportBrand[item.key as keyof typeof reportBrand],
                              })
                            }
                            className="rounded"
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Features */}
              {step === 4 && (
                <div className="flex-1 flex flex-col max-w-lg mx-auto">
                  <OwlStage
                    compact
                    eyebrow="Modules"
                    title="Select your features"
                    description="Choose which modules your school needs immediately. Start lean or go full-suite, then expand later."
                    chips={["Flexible rollout", selectedPlan.name]}
                    className="mb-6"
                  />

                  <h3 className="text-lg font-bold text-slate-800 mb-4">Feature Selection</h3>

                  <div className="space-y-3 mb-6">
                    <p className="text-xs text-slate-500 mb-3">
                      Turn on the modules your school needs immediately. Start lean or go full-suite, then expand later.
                    </p>
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
                        className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                          featureStage === option.key
                            ? "border-purple-500 bg-purple-50 shadow-sm"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <MaterialIcon
                            icon={option.icon}
                            className={featureStage === option.key ? "text-purple-600" : "text-slate-400"}
                          />
                          <div>
                            <h4 className="font-semibold text-slate-800">{option.label}</h4>
                            <p className="text-xs text-slate-500">{option.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Launch */}
              {step === 5 && (
                <div className="flex-1 flex flex-col max-w-md mx-auto">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Launch Ready</h3>
                  <p className="text-slate-500 mb-6">
                    Your school package, default calendar, and starter setup are already in place so the team can begin
                    working immediately.
                  </p>

                  <div className="grid grid-cols-1 gap-4 mb-6">
                    <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-slate-800">Chosen Package</h4>
                        <MaterialIcon icon="workspace_premium" className="text-teal-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{selectedPlan.name}</p>
                      <p className="text-sm text-slate-500 mt-2">
                        The school selected this package during registration. Billing can be refined later.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-slate-800">Calendar Ready</h4>
                        <MaterialIcon icon="calendar_month" className="text-blue-600" />
                      </div>
                      <p className="text-sm text-slate-500">
                        Uganda term dates and holiday windows are preloaded. Headteachers can tweak them later.
                      </p>
                    </div>
                  </div>

                  <Button variant="primary" onClick={handleComplete} loading={loading} className="w-full" size="lg">
                    Finish Setup & Launch
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Navigation - Mobile */}
          {step > 1 && step < TOTAL_STEPS && (
            <div
              className="md:hidden sticky bottom-0 bg-white border-t border-slate-100 px-4 py-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
            >
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => handleBack(step - 1)} className="flex-1">
                  Back
                </Button>
                <Button variant="primary" loading={saving} onClick={handleGenericNext} className="flex-1">
                  {step === TOTAL_STEPS - 1 ? "Review & Launch" : "Next"}
                </Button>
              </div>
            </div>
          )}

          {/* Desktop bottom nav for steps 2-4 */}
          {step > 1 && step < TOTAL_STEPS && (
            <div className="hidden md:flex gap-3 px-8 pb-8 pt-4">
              <Button variant="secondary" onClick={() => handleBack(step - 1)}>
                Back
              </Button>
              <Button variant="primary" loading={saving} onClick={handleGenericNext}>
                {step === TOTAL_STEPS - 1 ? "Review & Launch" : "Next Step"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
