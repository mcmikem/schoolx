"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Input, Select } from "@/components/ui";
import { buildUgandaAcademicTerms } from "@/lib/uganda-school-calendar";
import {
  getDefaultClassTemplates,
  type SchoolSetupType,
} from "@/lib/school-setup";
import { getErrorMessage } from "@/lib/validation";
import Image from "next/image";
import { logger } from "@/lib/logger";

interface Props {
  onComplete?: () => void;
}

const SETUP_STEPS = [
  {
    key: "academic_calendar",
    title: "Academic Calendar",
    icon: "calendar_month",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "class_structure",
    title: "Classes & Streams",
    icon: "school",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "fee_structure",
    title: "Fee Structure",
    icon: "payments",
    route: "/dashboard/fees",
  },
  {
    key: "report_card_branding",
    title: "Report Card",
    icon: "badge",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "staff_accounts",
    title: "Staff Accounts",
    icon: "people",
    route: "/dashboard/settings?tab=users",
  },
  {
    key: "sms_templates",
    title: "SMS Templates",
    icon: "sms",
    route: "/dashboard/sms-templates",
  },
  {
    key: "sms_automation",
    title: "SMS Automation",
    icon: "sync_alt",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "grading",
    title: "Grading",
    icon: "grade",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "signatures",
    title: "Signatures",
    icon: "signature",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "import_students",
    title: "Import Students",
    icon: "group_add",
    route: "/dashboard/students",
  },
];

export default function PostOnboardingSetup({ onComplete }: Props) {
  const router = useRouter();
  const { school, refreshSchool } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear().toString();
  const schoolType = (school?.school_type || "primary") as SchoolSetupType;

  // Inline form states
  const [reportBrand, setReportBrand] = useState({
    header: ((school as unknown as Record<string, unknown>)?.report_header_text as string) || "",
    footer: ((school as unknown as Record<string, unknown>)?.report_footer_text as string) || "",
    receipt_footer: ((school as unknown as Record<string, unknown>)?.receipt_footer_text as string) || "",
    show_position: (school as unknown as Record<string, unknown>)?.show_position_in_report !== false,
    show_conduct: (school as unknown as Record<string, unknown>)?.show_conduct_in_report !== false,
    show_attendance: (school as unknown as Record<string, unknown>)?.show_attendance_in_report !== false,
    show_remarks: (school as unknown as Record<string, unknown>)?.show_remarks_in_report !== false,
  });

  const [terms, setTerms] = useState(
    buildUgandaAcademicTerms("preview", currentYear).map((term) => ({
      name: term.name,
      code: term.code,
      term_number: term.term_number,
      start: term.start_date,
      end: term.end_date,
    })),
  );
  const [classes, setClasses] = useState<{ name: string; stream: string }[]>(
    getDefaultClassTemplates(schoolType).map((cls) => ({
      name: cls.name,
      stream: cls.stream,
    })),
  );
  const [fees, setFees] = useState<
    { name: string; amount: string; category: string; class_id: string | null }[]
  >([
    { name: "Tuition", amount: "150000", category: "Tuition", class_id: null },
    { name: "Development", amount: "50000", category: "Development", class_id: null },
  ]);
  const [applyFeeToAllClasses, setApplyFeeToAllClasses] = useState(true);

  const [smsAutomations, setSmsAutomations] = useState([
    { event_type: "fee_overdue", message_template: "", is_active: false, name: "Send fee reminder" },
    { event_type: "absentee_alert", message_template: "", is_active: false, name: "Alert on absence" },
    { event_type: "payment_confirmation", message_template: "", is_active: false, name: "Payment confirmation" },
    { event_type: "report_card_ready", message_template: "", is_active: false, name: "Report card ready" },
    { event_type: "exam_results", message_template: "", is_active: false, name: "Exam result published" },
  ]);

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

  const [signatures, setSignatures] = useState<{
    headteacher: File | null;
    class_teacher: File | null;
    headteacherPreview: string;
    classTeacherPreview: string;
  }>({
    headteacher: null,
    class_teacher: null,
    headteacherPreview: "",
    classTeacherPreview: "",
  });
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [importState, setImportState] = useState<{
    step: "upload" | "preview" | "importing" | "complete";
    rows: Record<string, string>[];
    errors: string[];
    success: number;
    failed: number;
  }>({ step: "upload", rows: [], errors: [], success: 0, failed: 0 });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one student");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] || ""; });
        return row;
      });
      setImportState({ ...importState, step: "preview", rows });
    };
    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    if (!school?.id) return;
    setImportState((prev) => ({ ...prev, step: "importing", errors: [] }));
    try {
      const res = await fetch("/api/import/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: importState.rows, schoolId: school.id }),
      });
      const result = await res.json();
      setImportState((prev) => ({
        ...prev,
        step: "complete",
        errors: result.errors || [],
        success: result.success || 0,
        failed: result.failed || 0,
      }));
      if (result.success > 0) await markComplete("import_students");
    } catch {
      toast.error("Import failed. Check your connection and try again.");
      setImportState((prev) => ({ ...prev, step: "upload" }));
    }
  };

  const downloadCsvTemplate = () => {
    const csv = "first_name,last_name,gender,class_name,parent_name,parent_phone\nJane,Doe,F,P.1,Parent Name,0700000000\nJohn,Smith,M,S.1,Guardian Name,0700000001";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "student_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const checkCompletedItems = useCallback(async () => {
    if (!school?.id) return;
    try {
      const { data } = await supabase
        .from("setup_checklist")
        .select("item_key, is_completed")
        .eq("school_id", school.id);

      if (data) {
        setCompleted(data.filter((i) => i.is_completed).map((i) => i.item_key));
      }
    } catch {
      logger.warn("Failed to load completed checklist items");
    }
  }, [school?.id]);

  useEffect(() => {
    checkCompletedItems();
  }, [checkCompletedItems]);

  useEffect(() => {
    setTerms(
      buildUgandaAcademicTerms(school?.id || "preview", currentYear).map(
        (term) => ({
          name: term.name,
          code: term.code,
          term_number: term.term_number,
          start: term.start_date,
          end: term.end_date,
        }),
      ),
    );
    setClasses(
      getDefaultClassTemplates(schoolType).map((cls) => ({
        name: cls.name,
        stream: cls.stream,
      })),
    );
  }, [school?.id, schoolType, currentYear]);

  const markComplete = async (key: string) => {
    if (!school?.id) return;
    try {
      const { error } = await supabase
        .from("setup_checklist")
        .upsert(
          {
            school_id: school.id,
            item_key: key,
            is_completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "school_id,item_key" },
        );
      if (error) throw error;
      setCompleted([...completed, key]);
      toast.success(`${SETUP_STEPS.find((s) => s.key === key)?.title} complete!`);
    } catch (err) {
      logger.warn("markComplete failed:", getErrorMessage(err));
    }
  };

  const saveTerms = async () => {
    if (!school?.id) return;
    setLoading(true);
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

      await markComplete("academic_calendar");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save terms"));
    } finally {
      setLoading(false);
    }
  };

  const saveClasses = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const classRows = classes
        .filter((cls) => cls.name)
        .map((cls) => ({
          school_id: school.id,
          name: cls.name,
          stream: cls.stream || null,
          level: cls.name.startsWith("P") ? "primary" : "secondary",
          academic_year: new Date().getFullYear().toString(),
        }));

      if (classRows.length > 0) {
        const { error } = await supabase.from("classes").upsert(classRows, {
          onConflict: "school_id,name,academic_year",
        });
        if (error) throw error;
      }

      await markComplete("class_structure");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save classes"));
    } finally {
      setLoading(false);
    }
  };

  const saveFees = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear().toString();
      const feeRows = fees
        .filter((fee) => fee.name && parseFloat(fee.amount) > 0)
        .map((fee) => ({
          school_id: school.id,
          name: fee.name,
          amount: parseFloat(fee.amount),
          category: fee.category,
          class_id: applyFeeToAllClasses ? null : fee.class_id || null,
          term: 1,
          academic_year: year,
        }));

      if (feeRows.length > 0) {
        const { error: insertError } = await supabase
          .from("fee_structure")
          .insert(feeRows);
        if (insertError) throw insertError;
      }

      await markComplete("fee_structure");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save fees"));
    } finally {
      setLoading(false);
    }
  };

  const saveReportBranding = async () => {
    if (!school?.id) return;
    setLoading(true);
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
      await markComplete("report_card_branding");
      toast.success("Report card settings saved");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save report card settings"));
    } finally {
      setLoading(false);
    }
  };

  const saveSmsAutomations = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const active = smsAutomations.filter((a) => a.is_active);
      if (active.length > 0) {
        const { error: delError } = await supabase
          .from("sms_triggers")
          .delete()
          .eq("school_id", school.id);
        if (delError) logger.warn("SMS trigger cleanup:", delError);

        const rows = active.map((a) => ({
          school_id: school.id,
          name: a.name,
          event_type: a.event_type,
          message_template: a.message_template || null,
          is_active: true,
        }));
        const { error } = await supabase.from("sms_triggers").insert(rows);
        if (error) throw error;
      }
      await markComplete("sms_automation");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save SMS automations"));
    } finally {
      setLoading(false);
    }
  };

  const saveGradingPrefs = async () => {
    if (!school?.id) return;
    setLoading(true);
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

      await markComplete("grading");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save grading preferences"));
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file: File, maxW = 400, maxH = 400, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        if (h > maxH) { w = (w * maxH) / h; h = maxH; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  };

  const uploadSignatureToStorage = async (file: File, type: "headteacher" | "class_teacher"): Promise<string | null> => {
    if (!school?.id) return null;
    try {
      const compressed = await compressImage(file);
      const filePath = `signature-${school.id}-${type}.jpg`;
      let { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(filePath, compressed, { contentType: "image/jpeg", upsert: true });
      if (uploadError && uploadError.message.includes("bucket")) {
        await supabase.storage.createBucket("school-logos", {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });
        const retry = await supabase.storage
          .from("school-logos")
          .upload(filePath, compressed, { contentType: "image/jpeg", upsert: true });
        if (retry.error) throw retry.error;
      } else if (uploadError) {
        throw uploadError;
      }
      const { data: urlData } = supabase.storage.from("school-logos").getPublicUrl(filePath);
      return urlData?.publicUrl || null;
    } catch (err) {
      logger.error("Signature upload failed:", err);
      return null;
    }
  };

  const saveSignatures = async () => {
    if (!school?.id) return;
    setUploadingSignature(true);
    try {
      let headteacherUrl = "";
      let classTeacherUrl = "";

      if (signatures.headteacher) {
        const url = await uploadSignatureToStorage(signatures.headteacher, "headteacher");
        if (url) headteacherUrl = url;
      }
      if (signatures.class_teacher) {
        const url = await uploadSignatureToStorage(signatures.class_teacher, "class_teacher");
        if (url) classTeacherUrl = url;
      }

      const updateData: Record<string, string> = {};
      if (headteacherUrl) updateData.signature_headteacher_url = headteacherUrl;
      if (classTeacherUrl) updateData.signature_class_teacher_url = classTeacherUrl;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("schools")
          .update(updateData)
          .eq("id", school.id);
        if (error) throw error;
      }

      await markComplete("signatures");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save signatures"));
    } finally {
      setUploadingSignature(false);
    }
  };

  if (!school) return null;

  const incompleteSteps = SETUP_STEPS.filter((s) => !completed.includes(s.key));
  const progress = Math.round(
    ((SETUP_STEPS.length - incompleteSteps.length) / SETUP_STEPS.length) * 100,
  );

  return (
    <>
      {/* Collapsed State - Floating Button */}
      {!isOpen && completed.length < SETUP_STEPS.length && (
        <div className="fixed bottom-24 right-6 md:bottom-6 z-[85]">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 rounded-full border border-[#d7dfea] bg-white px-3 py-2 text-[var(--t1)] shadow-[0_18px_40px_rgba(11,28,57,0.16)] transition-all hover:-translate-y-0.5"
          >
            <OwlMascot size={40} premium />
            <span className="font-medium">Setup ({progress}%)</span>
          </button>
        </div>
      )}

      {/* Slide-over Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-[85] w-full max-w-md transform bg-[linear-gradient(180deg,#fffdfa_0%,#f7f4ec_100%)] shadow-2xl transition-transform duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e0e6ee] bg-white/84 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <OwlMascot size={46} premium ring glow />
              <div>
              <h2 className="font-bold text-[var(--on-surface)]">
                School Setup
              </h2>
              <p className="text-sm text-[var(--t3)]">{progress}% complete</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-[var(--surface-container-high)]"
            >
              <MaterialIcon icon="close" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-[var(--border)]">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto h-[calc(100vh-120px)] space-y-4">
            {incompleteSteps.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 flex justify-center">
                  <OwlMascot size={72} premium ring glow animated />
                </div>
                <h3 className="font-bold text-lg mb-2">All Done! 🎉</h3>
                <p className="text-[var(--t3)] mb-6">
                  Your school is ready to use.
                </p>
                <Button onClick={onComplete} className="w-full">
                  Go to Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => setIsOpen(false)}
                >
                  Keep exploring
                </Button>
              </div>
            ) : (
              incompleteSteps.map((step, idx) => (
                <Card key={step.key} className={idx === 0 ? "ring-2 ring-[var(--primary)]" : ""}>
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-[#dbe3ed] bg-white shadow-sm">
                        <MaterialIcon
                          icon={step.icon}
                          className="text-[var(--primary)]"
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">{step.title}</h3>
                        <p className="text-xs text-[var(--t3)]">
                          {idx === 0 ? "Required" : "Optional"}
                        </p>
                      </div>
                    </div>

                    {/* Inline Forms */}
                    {idx === 0 && step.key === "academic_calendar" && (
                      <div className="space-y-3 mb-4">
                        {terms.map((term, i) => (
                          <div key={i} className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={term.name}
                              readOnly
                              className="input text-sm bg-gray-50"
                            />
                            <input
                              type="date"
                              value={term.start}
                              onChange={(e) => {
                                const newTerms = [...terms];
                                newTerms[i].start = e.target.value;
                                setTerms(newTerms);
                              }}
                              className="input text-sm"
                              placeholder="Start"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          onClick={saveTerms}
                          loading={loading}
                          className="w-full"
                        >
                          Save Terms
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "class_structure" && (
                      <div className="space-y-3 mb-4">
                        {classes.map((cls, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={cls.name}
                              onChange={(e) => {
                                const newClasses = [...classes];
                                newClasses[i].name = e.target.value;
                                setClasses(newClasses);
                              }}
                              className="input text-sm flex-1"
                              placeholder="Class (e.g., P.1)"
                            />
                            <input
                              type="text"
                              value={cls.stream}
                              onChange={(e) => {
                                const newClasses = [...classes];
                                newClasses[i].stream = e.target.value;
                                setClasses(newClasses);
                              }}
                              className="input text-sm flex-1"
                              placeholder="Stream (optional)"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setClasses([...classes, { name: "", stream: "" }])
                          }
                          className="w-full"
                        >
                          <MaterialIcon icon="add" className="text-sm" /> Add
                          Class
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveClasses}
                          loading={loading}
                          className="w-full"
                        >
                          Save Classes
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "fee_structure" && (
                      <div className="space-y-3 mb-4">
                        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={applyFeeToAllClasses}
                            onChange={() => setApplyFeeToAllClasses(!applyFeeToAllClasses)}
                            className="rounded"
                          />
                          Apply to all classes
                        </label>
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
                                className="input text-sm flex-1"
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
                                className="input text-sm w-28"
                                placeholder="UGX"
                              />
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={fee.category}
                                onChange={(e) => {
                                  const newFees = [...fees];
                                  newFees[i].category = e.target.value;
                                  setFees(newFees);
                                }}
                                className="input text-sm flex-1"
                              >
                                <option value="Tuition">Tuition</option>
                                <option value="Development">Development</option>
                                <option value="PTA">PTA</option>
                                <option value="Lunch">Lunch</option>
                                <option value="Transport">Transport</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setFees([...fees, { name: "", amount: "", category: "Tuition", class_id: null }])
                          }
                          className="w-full"
                        >
                          <MaterialIcon icon="add" className="text-sm" /> Add
                          Fee
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveFees}
                          loading={loading}
                          className="w-full"
                        >
                          Save Fees
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "report_card_branding" && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Report Header Text
                          </label>
                          <input
                            type="text"
                            value={reportBrand.header}
                            onChange={(e) =>
                              setReportBrand({ ...reportBrand, header: e.target.value })
                            }
                            className="input text-sm w-full"
                            placeholder="Annual Academic Report"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Report Footer Text
                          </label>
                          <input
                            type="text"
                            value={reportBrand.footer}
                            onChange={(e) =>
                              setReportBrand({ ...reportBrand, footer: e.target.value })
                            }
                            className="input text-sm w-full"
                            placeholder="Education is the key to success"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Receipt Footer Text
                          </label>
                          <input
                            type="text"
                            value={reportBrand.receipt_footer}
                            onChange={(e) =>
                              setReportBrand({ ...reportBrand, receipt_footer: e.target.value })
                            }
                            className="input text-sm w-full"
                            placeholder="Thank you for your payment"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
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
                                checked={
                                  reportBrand[item.key as keyof typeof reportBrand] as boolean
                                }
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
                        <Button
                          size="sm"
                          onClick={saveReportBranding}
                          loading={loading}
                          className="w-full"
                        >
                          Save Report Settings
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "sms_automation" && (
                      <div className="space-y-3 mb-4">
                        {smsAutomations.map((auto, i) => (
                          <div key={auto.event_type} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                            <label className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-700">{auto.name}</span>
                              <input
                                type="checkbox"
                                checked={auto.is_active}
                                onChange={() => {
                                  const next = [...smsAutomations];
                                  next[i].is_active = !next[i].is_active;
                                  setSmsAutomations(next);
                                }}
                                className="rounded"
                              />
                            </label>
                            {auto.is_active && (
                              <textarea
                                value={auto.message_template}
                                onChange={(e) => {
                                  const next = [...smsAutomations];
                                  next[i].message_template = e.target.value;
                                  setSmsAutomations(next);
                                }}
                                className="input text-sm w-full"
                                rows={2}
                                placeholder="Optional message template..."
                              />
                            )}
                          </div>
                        ))}
                        <Button
                          size="sm"
                          onClick={saveSmsAutomations}
                          loading={loading}
                          className="w-full"
                        >
                          Save Automation Settings
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "grading" && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Passing Mark
                          </label>
                          <input
                            type="number"
                            value={gradingPrefs.passing_mark}
                            onChange={(e) =>
                              setGradingPrefs({ ...gradingPrefs, passing_mark: parseInt(e.target.value) || 0 })
                            }
                            className="input text-sm w-full"
                            min={0}
                            max={100}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Grade Labels &amp; Score Ranges
                          </label>
                          {gradingPrefs.grades.map((g, i) => (
                            <div key={g.label} className="flex gap-2 items-center mb-2">
                              <span className="text-sm font-bold w-8">{g.label}</span>
                              <input
                                type="number"
                                value={g.min}
                                onChange={(e) => {
                                  const newGrades = [...gradingPrefs.grades];
                                  newGrades[i].min = parseInt(e.target.value) || 0;
                                  setGradingPrefs({ ...gradingPrefs, grades: newGrades });
                                }}
                                className="input text-sm w-20"
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
                                className="input text-sm w-20"
                                placeholder="Max"
                              />
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={saveGradingPrefs}
                          loading={loading}
                          className="w-full"
                        >
                          Save Grading Preferences
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "signatures" && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Headteacher Signature
                          </label>
                          {signatures.headteacherPreview && (
                            <div className="mb-2">
                              <Image
                                src={signatures.headteacherPreview}
                                alt="Headteacher signature preview"
                                width={80}
                                height={80}
                                className="max-h-16 border border-slate-200 rounded"
                              />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSignatures({
                                  ...signatures,
                                  headteacher: file,
                                  headteacherPreview: URL.createObjectURL(file),
                                });
                              }
                            }}
                            className="text-sm w-full"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Class Teacher Signature
                          </label>
                          {signatures.classTeacherPreview && (
                            <div className="mb-2">
                              <Image
                                src={signatures.classTeacherPreview}
                                alt="Class teacher signature preview"
                                width={80}
                                height={80}
                                className="max-h-16 border border-slate-200 rounded"
                              />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSignatures({
                                  ...signatures,
                                  class_teacher: file,
                                  classTeacherPreview: URL.createObjectURL(file),
                                });
                              }
                            }}
                            className="text-sm w-full"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={saveSignatures}
                          loading={uploadingSignature}
                          className="w-full"
                        >
                          Upload Signatures
                        </Button>
                      </div>
                    )}

                    {step.key === "import_students" && (
                      <div className="space-y-3 mb-4">
                        {importState.step === "upload" && (
                          <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                              Upload a CSV file with columns: first_name, last_name, gender (M/F), class_name, parent_name, parent_phone
                            </p>
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:border-slate-400">
                              <MaterialIcon icon="upload_file" className="text-lg" />
                              Choose CSV file
                              <input type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
                            </label>
                            <button
                              type="button"
                              onClick={downloadCsvTemplate}
                              className="text-xs text-[var(--primary)] hover:underline"
                            >
                              Download template CSV
                            </button>
                          </div>
                        )}
                        {importState.step === "preview" && (
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-slate-700">
                              {importState.rows.length} students found
                            </p>
                            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                              <table className="w-full">
                                <thead className="bg-slate-100 text-left">
                                  <tr>
                                    <th className="px-2 py-1">Name</th>
                                    <th className="px-2 py-1">Gender</th>
                                    <th className="px-2 py-1">Class</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {importState.rows.slice(0, 10).map((r, i) => (
                                    <tr key={i} className="border-t border-slate-100">
                                      <td className="px-2 py-1">{r.first_name} {r.last_name}</td>
                                      <td className="px-2 py-1">{r.gender}</td>
                                      <td className="px-2 py-1">{r.class_name}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleRunImport} className="flex-1">
                                Import {importState.rows.length} Students
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setImportState((p) => ({ ...p, step: "upload", rows: [] }))}>
                                Change file
                              </Button>
                            </div>
                          </div>
                        )}
                        {importState.step === "importing" && (
                          <div className="flex items-center justify-center py-6">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--primary)]" />
                            <span className="ml-3 text-sm text-slate-600">Importing students...</span>
                          </div>
                        )}
                        {importState.step === "complete" && (
                          <div className="space-y-3">
                            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                              {importState.success} students added successfully
                            </div>
                            {importState.failed > 0 && (
                              <div className="max-h-32 overflow-y-auto rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                                {importState.errors.slice(0, 10).map((e, i) => (
                                  <p key={i}>{e}</p>
                                ))}
                              </div>
                            )}
                            <Button size="sm" onClick={() => setImportState((p) => ({ ...p, step: "upload", rows: [], errors: [], success: 0, failed: 0 }))} className="w-full">
                              Done
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {idx > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(step.route)}
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markComplete(step.key)}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))
            )}

            {/* Skip All */}
            {incompleteSteps.length > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  className="w-full text-[var(--t3)]"
                  onClick={() => {
                    setIsOpen(false);
                    onComplete?.();
                  }}
                >
                  Skip all for now
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[84] bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
