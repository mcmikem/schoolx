"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { removePreviousPhoto, uploadStudentPhoto } from "@/lib/student-photos";
import { withTimeout } from "@/lib/hooks/utils";

interface UploadResult {
  studentNumber: string;
  studentName: string;
  status: "success" | "skipped" | "error";
  message: string;
}

export default function BatchPhotosPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  // The files behind the last full run, so "retry failed" can re-run just the
  // stragglers instead of all 300. File objects stay valid while the page lives.
  const [lastFiles, setLastFiles] = useState<File[]>([]);

  const handleFiles = async (files: FileList | File[], options?: { retryFailed?: boolean }) => {
    if (!school?.id) {
      toast.error("No school selected");
      return;
    }
    if (isDemo) {
      toast.error("Photo upload is not available in demo mode");
      return;
    }

    const retryNumbers = options?.retryFailed
      ? new Set(results.filter((r) => r.status === "error").map((r) => r.studentNumber))
      : null;
    const imageFiles = Array.from(files).filter(
      (f) =>
        /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name) &&
        (!retryNumbers || retryNumbers.has(f.name.replace(/\.[^.]+$/, ""))),
    );
    if (!imageFiles.length) {
      toast.error(
        options?.retryFailed ? "No failed files left to retry" : "No image files found. Supported: JPG, PNG, WebP, GIF",
      );
      return;
    }

    setUploading(true);
    if (!options?.retryFailed) {
      setLastFiles(imageFiles);
      setResults([]);
    }
    setProgress({ current: 0, total: imageFiles.length });

    const uploadResults: UploadResult[] = [];

    // One roster read for the whole batch. The old code looked each pupil up
    // by student_number inside the loop — 300 files meant 300 extra round
    // trips before a single byte was uploaded.
    const rosterResult = await withTimeout<{
      data:
        | { id: string; student_number: string; first_name: string; last_name: string; photo_url: string | null }[]
        | null;
      error: { message: string } | null;
    }>(
      supabase
        .from("students")
        .select("id, student_number, first_name, last_name, photo_url")
        .eq("school_id", school.id)
        .limit(1000)
        .then((r) => ({
          data: (r.data || []) as unknown as {
            id: string;
            student_number: string;
            first_name: string;
            last_name: string;
            photo_url: string | null;
          }[],
          error: r.error ? { message: r.error.message } : null,
        })),
      15000,
      { data: null, error: { message: "Loading the student list timed out. Check the connection and try again." } },
    );
    const roster = rosterResult.data;
    const rosterError = rosterResult.error;
    if (rosterError) {
      toast.error(rosterError.message || "Failed to load students");
      setUploading(false);
      return;
    }
    const rosterByNumber = new Map((roster || []).map((s: { student_number: string }) => [s.student_number, s]));

    for (const file of imageFiles) {
      const studentNumber = file.name.replace(/\.[^.]+$/, "");
      const current = uploadResults.length + 1;
      setProgress({ current, total: imageFiles.length });

      try {
        const student = rosterByNumber.get(studentNumber) as
          | { id: string; first_name: string; last_name: string; photo_url: string | null }
          | undefined;

        if (!student) {
          uploadResults.push({
            studentNumber,
            studentName: "Unknown",
            status: "skipped",
            message: "No student found with this number",
          });
          continue;
        }

        // Batch onboarding photos are roster thumbnails: cap them well below the
        // 1600px default so 300 pupils do not each cost a full camera-size file.
        const { publicUrl, filePath } = await uploadStudentPhoto({
          file,
          schoolId: school.id,
          studentId: student.id,
          maxWidth: 1024,
          maxHeight: 1024,
        });

        const { error: updateError } = await withTimeout<{ error: { message: string } | null }>(
          supabase
            .from("students")
            .update({ photo_url: publicUrl })
            .eq("id", student.id)
            .then((r) => ({ error: r.error ? { message: r.error.message } : null })),
          30000,
          {
            error: {
              message:
                "Saving the photo timed out. The upload itself may have succeeded — re-run this file to confirm.",
            },
          },
        );

        if (updateError) {
          uploadResults.push({
            studentNumber,
            studentName: `${student.first_name} ${student.last_name}`,
            status: "error",
            message: updateError.message,
          });
          continue;
        }

        // The new upload may live at a different path than the old photo
        // (`.jpg` → `.webp`). Remove the orphan only after the new URL is
        // saved, so a failed save never leaves the row pointing at a deleted file.
        await removePreviousPhoto(student.photo_url, filePath);

        uploadResults.push({
          studentNumber,
          studentName: `${student.first_name} ${student.last_name}`,
          status: "success",
          message: "Photo updated",
        });
      } catch (err: unknown) {
        uploadResults.push({
          studentNumber,
          studentName: "Unknown",
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    const retriedNumbers = new Set(uploadResults.map((r) => r.studentNumber));
    if (options?.retryFailed) {
      // Keep the earlier successes; only the retried rows are replaced.
      setResults((prev) => [...prev.filter((r) => !retriedNumbers.has(r.studentNumber)), ...uploadResults]);
    } else {
      setResults(uploadResults);
    }
    setUploading(false);
    const successCount = uploadResults.filter((r) => r.status === "success").length;
    toast.success(`${successCount} of ${uploadResults.length} photos uploaded`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;

  return (
    <PageErrorBoundary>
      <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
        <PageHeader
          title="Batch Photo Upload"
          subtitle="Upload student photos matching by student_number"
          variant="premium"
        />

        <Card>
          <CardHeader>
            <CardTitle>Upload Photos</CardTitle>
          </CardHeader>
          <CardBody>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              <MaterialIcon icon="cloud_upload" className="text-5xl text-[var(--t3)] mb-3" />
              <p className="text-lg font-semibold text-[var(--t1)] mb-1">Drop photos here or click to browse</p>
              <p className="text-sm text-[var(--t3)]">
                Name files as{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">student_number.jpg</code> (e.g.
                STU001.jpg)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">
                    Uploading... ({progress.current}/{progress.total})
                  </span>
                  <span className="text-[var(--t3)]">{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    {successCount} Success
                  </div>
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    {errorCount} Failed
                  </div>
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {skipCount} Skipped
                  </div>
                  {!uploading && errorCount > 0 && lastFiles.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => handleFiles(lastFiles, { retryFailed: true })}>
                      <MaterialIcon icon="refresh" className="text-sm" />
                      Retry {errorCount} failed
                    </Button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        r.status === "success"
                          ? "bg-green-50 text-green-800"
                          : r.status === "error"
                            ? "bg-red-50 text-red-800"
                            : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      <span>
                        <span className="font-mono font-medium">{r.studentNumber}</span>
                        {r.studentName !== "Unknown" && <span className="ml-2">({r.studentName})</span>}
                      </span>
                      <span className="text-xs">{r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageErrorBoundary>
  );
}
