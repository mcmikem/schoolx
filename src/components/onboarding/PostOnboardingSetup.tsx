"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";
import { Card, CardBody } from "@/components/ui/Card";
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
      {/* Collapsed State - Floating Button */}
      {!isOpen && incompleteSteps.length > 0 && (
        <div className="fixed bottom-24 right-6 md:bottom-6 z-[85]">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 rounded-full border border-[#d7dfea] bg-white px-3 py-2 text-[var(--t1)] shadow-[0_18px_40px_rgba(11,28,57,0.16)] transition-all hover:-translate-y-0.5"
          >
            <OwlMascot size={40} premium />
            <span className="font-medium">Optional Setup ({progress}%)</span>
          </button>
        </div>
      )}

      {/* Slide-over Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-[85] w-full max-w-md flex flex-col transform bg-[linear-gradient(180deg,#fffdfa_0%,#f7f4ec_100%)] shadow-2xl transition-transform duration-300 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between border-b border-[#e0e6ee] bg-white/84 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <OwlMascot size={46} premium ring glow />
              <div>
                <h2 className="font-bold text-[var(--on-surface)]">
                  Optional Setup
                </h2>
                <p className="text-sm text-[var(--t3)]">
                  {incompleteSteps.length === 0 ? "All done!" : `${incompleteSteps.length} remaining`}
                </p>
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
          {OPTIONAL_STEPS.length > 0 && (
            <div className="h-1 bg-[var(--border)]">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {incompleteSteps.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 flex justify-center">
                  <OwlMascot size={72} premium ring glow animated />
                </div>
                <h3 className="font-bold text-lg mb-2">All Done!</h3>
                <p className="text-[var(--t3)] mb-6">
                  Your school is fully configured.
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
              incompleteSteps.map((item, idx) => (
                <Card key={item.key} className={idx === 0 ? "ring-2 ring-[var(--primary)]" : ""}>
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-[#dbe3ed] bg-white shadow-sm">
                        <MaterialIcon icon={item.icon} className="text-[var(--primary)]" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-xs text-[var(--t3)]">{item.desc}</p>
                      </div>
                    </div>

                    {/* SMS Automation */}
                    {item.key === "sms_automation" && (
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
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
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

                    {/* Student Import */}
                    {item.key === "import_students" && (
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

                    {/* Signatures */}
                    {item.key === "signatures" && (
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
                                unoptimized
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
                                unoptimized
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

                    {/* Skip button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => { await markComplete(item.key); }}
                      className="w-full"
                    >
                      Skip for now
                    </Button>
                  </CardBody>
                </Card>
              ))
            )}

            {/* Skip All / Done */}
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
