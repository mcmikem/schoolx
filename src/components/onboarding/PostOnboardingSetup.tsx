"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";
import { Button } from "@/components/ui";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/validation";
import Image from "next/image";

interface Props {
  onComplete?: () => void;
}

const OPTIONAL_STEPS = [
  { key: "sms_automation", title: "SMS Automation", icon: "sync_alt", desc: "Auto-send fee reminders, absence alerts, and more" },
  { key: "import_students", title: "Import Students", icon: "group_add", desc: "Bulk upload students from a CSV file" },
  { key: "signatures", title: "Signatures", icon: "signature", desc: "Upload headteacher & class teacher signatures" },
];

export default function PostOnboardingSetup({ onComplete }: Props) {
  const { school, refreshSchool } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(OPTIONAL_STEPS[0]?.key ?? null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const [smsAutomations, setSmsAutomations] = useState([
    { event_type: "fee_overdue", message_template: "", is_active: false, name: "Send fee reminder" },
    { event_type: "absentee_alert", message_template: "", is_active: false, name: "Alert on absence" },
    { event_type: "payment_confirmation", message_template: "", is_active: false, name: "Payment confirmation" },
    { event_type: "report_card_ready", message_template: "", is_active: false, name: "Report card ready" },
    { event_type: "exam_results", message_template: "", is_active: false, name: "Exam result published" },
  ]);

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

  const markComplete = useCallback(async (key: string) => {
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
      setCompleted((prev) => [...prev, key]);
      toast.success(`${OPTIONAL_STEPS.find((s) => s.key === key)?.title} marked complete!`);
    } catch (err) {
      logger.warn("markComplete failed:", getErrorMessage(err));
    }
  }, [school?.id, toast]);

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

  const incompleteSteps = OPTIONAL_STEPS.filter((s) => !completed.includes(s.key));
  const progress = OPTIONAL_STEPS.length > 0
    ? Math.round(((OPTIONAL_STEPS.length - incompleteSteps.length) / OPTIONAL_STEPS.length) * 100)
    : 100;

  return (
    <>
      {/* Collapsed — compact floating pill */}
      {!isOpen && incompleteSteps.length > 0 && (
        <div className="fixed bottom-20 right-4 md:bottom-6 z-[85]">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-[#d7dfea] bg-white px-4 py-2 text-sm font-medium text-[var(--t1)] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <MaterialIcon icon="tune" className="text-[var(--primary)] text-base" />
            <span>Optional Setup</span>
            <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
              {incompleteSteps.length}
            </span>
          </button>
        </div>
      )}

      {/* Panel — bottom sheet on mobile, right panel on md+ */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[85] flex flex-col rounded-t-2xl bg-white shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:w-[360px] md:rounded-none md:max-h-full max-h-[78vh] transition-all duration-300">

          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-2.5 pb-0 md:hidden flex-shrink-0">
            <div className="h-1 w-10 rounded-full bg-slate-200" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="font-semibold text-sm text-[var(--on-surface)]">Optional Setup</h2>
              <p className="text-xs text-[var(--t3)]">
                {incompleteSteps.length === 0
                  ? "All done!"
                  : `${incompleteSteps.length} of ${OPTIONAL_STEPS.length} steps remaining`}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <MaterialIcon icon="close" className="text-lg" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 flex-shrink-0 bg-slate-100">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {incompleteSteps.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <OwlMascot size={56} premium ring glow animated />
                <h3 className="font-bold text-base">All Done!</h3>
                <p className="text-sm text-[var(--t3)]">Your school is fully configured.</p>
                <Button onClick={onComplete} className="w-full mt-2">Go to Dashboard</Button>
                <Button variant="ghost" className="w-full" onClick={() => setIsOpen(false)}>Keep exploring</Button>
              </div>
            ) : (
              incompleteSteps.map((item) => {
                const isExpanded = expandedKey === item.key;
                return (
                  <div key={item.key}>
                    {/* Accordion header */}
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#dbe3ed] bg-white shadow-sm">
                        <MaterialIcon icon={item.icon} className="text-[var(--primary)] text-base" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--on-surface)]">{item.title}</div>
                        <div className="truncate text-xs text-[var(--t3)]">{item.desc}</div>
                      </div>
                      <MaterialIcon
                        icon={isExpanded ? "expand_less" : "expand_more"}
                        className="flex-shrink-0 text-slate-400"
                      />
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="bg-slate-50/60 px-4 pb-4 pt-1 space-y-3">
                        {/* SMS Automation */}
                        {item.key === "sms_automation" && (
                          <>
                            {smsAutomations.map((auto, i) => (
                              <div key={auto.event_type} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                <label className="flex items-center justify-between gap-2">
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
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                                    rows={2}
                                    placeholder="Optional message template..."
                                  />
                                )}
                              </div>
                            ))}
                            <Button size="sm" onClick={saveSmsAutomations} loading={loading} className="w-full">
                              Save Automation Settings
                            </Button>
                          </>
                        )}

                        {/* Student Import */}
                        {item.key === "import_students" && (
                          <>
                            {importState.step === "upload" && (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-500">
                                  CSV columns: first_name, last_name, gender (M/F), class_name, parent_name, parent_phone
                                </p>
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600 hover:border-slate-400">
                                  <MaterialIcon icon="upload_file" className="text-lg" />
                                  Choose CSV file
                                  <input type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
                                </label>
                                <button type="button" onClick={downloadCsvTemplate} className="text-xs text-[var(--primary)] hover:underline">
                                  Download template CSV
                                </button>
                              </div>
                            )}
                            {importState.step === "preview" && (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-700">{importState.rows.length} students found</p>
                                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                                  <table className="w-full">
                                    <thead className="bg-slate-100 text-left">
                                      <tr>
                                        <th className="px-2 py-1">Name</th>
                                        <th className="px-2 py-1">G</th>
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
                                    Import {importState.rows.length}
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => setImportState((p) => ({ ...p, step: "upload", rows: [] }))}>
                                    Change
                                  </Button>
                                </div>
                              </div>
                            )}
                            {importState.step === "importing" && (
                              <div className="flex items-center justify-center py-4 gap-3">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--primary)]" />
                                <span className="text-sm text-slate-600">Importing...</span>
                              </div>
                            )}
                            {importState.step === "complete" && (
                              <div className="space-y-2">
                                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                                  {importState.success} students added
                                </div>
                                {importState.failed > 0 && (
                                  <div className="max-h-28 overflow-y-auto rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 space-y-0.5">
                                    {importState.errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
                                  </div>
                                )}
                                <Button size="sm" onClick={() => setImportState({ step: "upload", rows: [], errors: [], success: 0, failed: 0 })} className="w-full">
                                  Done
                                </Button>
                              </div>
                            )}
                          </>
                        )}

                        {/* Signatures */}
                        {item.key === "signatures" && (
                          <div className="space-y-3">
                            {(["headteacher", "class_teacher"] as const).map((type) => (
                              <div key={type}>
                                <label className="mb-1 block text-xs font-semibold text-slate-600">
                                  {type === "headteacher" ? "Headteacher" : "Class Teacher"} Signature
                                </label>
                                {(type === "headteacher" ? signatures.headteacherPreview : signatures.classTeacherPreview) && (
                                  <div className="mb-2">
                                    <Image
                                      src={type === "headteacher" ? signatures.headteacherPreview : signatures.classTeacherPreview}
                                      alt={`${type} signature preview`}
                                      width={80}
                                      height={80}
                                      unoptimized
                                      className="max-h-16 rounded border border-slate-200"
                                    />
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (type === "headteacher") {
                                      setSignatures((s) => ({ ...s, headteacher: file, headteacherPreview: URL.createObjectURL(file) }));
                                    } else {
                                      setSignatures((s) => ({ ...s, class_teacher: file, classTeacherPreview: URL.createObjectURL(file) }));
                                    }
                                  }}
                                  className="w-full text-sm"
                                />
                              </div>
                            ))}
                            <Button size="sm" onClick={saveSignatures} loading={uploadingSignature} className="w-full">
                              Upload Signatures
                            </Button>
                          </div>
                        )}

                        {/* Skip for now */}
                        <button
                          type="button"
                          onClick={() => {
                            markComplete(item.key);
                            const remaining = incompleteSteps.filter((s) => s.key !== item.key);
                            setExpandedKey(remaining[0]?.key ?? null);
                          }}
                          className="w-full text-center text-xs text-[var(--t3)] underline-offset-2 hover:underline hover:text-[var(--t1)] py-1"
                        >
                          Skip for now
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {incompleteSteps.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => { setIsOpen(false); onComplete?.(); }}
                className="w-full text-center text-xs text-[var(--t3)] underline-offset-2 hover:underline hover:text-[var(--t1)]"
              >
                Skip all optional setup →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[84] bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
