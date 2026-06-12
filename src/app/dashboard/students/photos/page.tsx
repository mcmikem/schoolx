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
import { compressStudentPhoto } from "@/lib/student-photos";

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

  const handleFiles = async (files: FileList) => {
    if (!school?.id) {
      toast.error("No school selected");
      return;
    }
    if (isDemo) {
      toast.error("Photo upload is not available in demo mode");
      return;
    }

    const imageFiles = Array.from(files).filter((f) =>
      /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name),
    );
    if (!imageFiles.length) {
      toast.error("No image files found. Supported: JPG, PNG, WebP, GIF");
      return;
    }

    setUploading(true);
    setResults([]);
    setProgress({ current: 0, total: imageFiles.length });

    const uploadResults: UploadResult[] = [];

    for (const file of imageFiles) {
      const studentNumber = file.name.replace(/\.[^.]+$/, "");
      const current = uploadResults.length + 1;
      setProgress({ current, total: imageFiles.length });

      try {
        const { data: student, error: lookupError } = await supabase
          .from("students")
          .select("id, first_name, last_name, photo_url")
          .eq("school_id", school.id)
          .eq("student_number", studentNumber)
          .maybeSingle();

        if (lookupError || !student) {
          uploadResults.push({
            studentNumber,
            studentName: "Unknown",
            status: "skipped",
            message: "No student found with this number",
          });
          continue;
        }

        const compressed = await compressStudentPhoto(file);
        const filePath = `${school.id}/students/${student.id}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("student-photos")
          .upload(filePath, compressed, {
            upsert: true,
            contentType: "image/jpeg",
          });

        if (uploadError) {
          uploadResults.push({
            studentNumber,
            studentName: `${student.first_name} ${student.last_name}`,
            status: "error",
            message: uploadError.message,
          });
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("student-photos").getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from("students")
          .update({ photo_url: publicUrl })
          .eq("id", student.id);

        if (updateError) {
          uploadResults.push({
            studentNumber,
            studentName: `${student.first_name} ${student.last_name}`,
            status: "error",
            message: updateError.message,
          });
          continue;
        }

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

    setResults(uploadResults);
    setUploading(false);
    const successCount = uploadResults.filter(
      (r) => r.status === "success",
    ).length;
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
              <MaterialIcon
                icon="cloud_upload"
                className="text-5xl text-[var(--t3)] mb-3"
              />
              <p className="text-lg font-semibold text-[var(--t1)] mb-1">
                Drop photos here or click to browse
              </p>
              <p className="text-sm text-[var(--t3)]">
                Name files as{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  student_number.jpg
                </code>{" "}
                (e.g. STU001.jpg)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) =>
                  e.target.files && handleFiles(e.target.files)
                }
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">
                    Uploading... ({progress.current}/{progress.total})
                  </span>
                  <span className="text-[var(--t3)]">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
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
                <div className="flex gap-3 mb-4">
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    {successCount} Success
                  </div>
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    {errorCount} Failed
                  </div>
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {skipCount} Skipped
                  </div>
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
                        <span className="font-mono font-medium">
                          {r.studentNumber}
                        </span>
                        {r.studentName !== "Unknown" && (
                          <span className="ml-2">({r.studentName})</span>
                        )}
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
