"use client";

import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import {
  FEATURE_STAGES,
  FeatureStage,
  DEFAULT_FEATURE_STAGE,
} from "@/lib/featureStages";
import MaterialIcon from "@/components/MaterialIcon";

interface GeneralSettingsProps {
  schoolData: {
    name: string;
    district: string;
    subcounty: string;
    phone: string;
    email: string;
  };
  setSchoolData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      district: string;
      subcounty: string;
      phone: string;
      email: string;
    }>
  >;
  logoUrl: string;
  setLogoUrl: React.Dispatch<React.SetStateAction<string>>;
  uploadingLogo: boolean;
  setUploadingLogo: React.Dispatch<React.SetStateAction<boolean>>;
  storageStatus: "unknown" | "ok" | "error";
  setStorageStatus: React.Dispatch<
    React.SetStateAction<"unknown" | "ok" | "error">
  >;
  saving: boolean;
  selectedStage: FeatureStage;
  setSelectedStage: React.Dispatch<React.SetStateAction<FeatureStage>>;
  savingStage: boolean;
  refreshSchool: () => Promise<void>;
}

type SignatureType = "signature_headteacher" | "signature_class_teacher";

const stageOrder: FeatureStage[] = ["core", "academic", "finance", "full"];

export default function GeneralSettings({
  schoolData,
  setSchoolData,
  logoUrl,
  setLogoUrl,
  uploadingLogo,
  setUploadingLogo,
  storageStatus,
  setStorageStatus,
  saving,
  selectedStage,
  setSelectedStage,
  savingStage,
  refreshSchool,
}: GeneralSettingsProps) {
  const { school } = useAuth();
  const toast = useToast();

  const compressImage = async (
    file: File,
    maxWidth = 400,
    maxHeight = 400,
  ): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(
                new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                }),
              );
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.8,
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const testStorage = async () => {
    try {
      setStorageStatus("unknown");
      toast.info("Testing storage connection...");

      const response = await fetch("/api/storage", { method: "GET" });
      const result = await response.json();

      console.debug("Storage check:", result);

      if (result.success) {
        if (result.exists) {
          setStorageStatus("ok");
          toast.success("Storage bucket exists!");
        } else {
          toast.info("Creating bucket...");
          const createResponse = await fetch("/api/storage", {
            method: "POST",
          });
          const createResult = await createResponse.json();

          if (createResult.success) {
            setStorageStatus("ok");
            toast.success("Storage bucket created!");
          } else {
            setStorageStatus("error");
            toast.error(`Failed: ${createResult.error}`);
          }
        }
      } else {
        setStorageStatus("error");
        toast.error(result.error || "Storage error");
      }
    } catch (err) {
      console.error("Storage test exception:", err);
      setStorageStatus("error");
      toast.error("Failed to connect to storage");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !school?.id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const bucketCheck = await fetch("/api/storage", { method: "GET" });
      const bucketResult = await bucketCheck.json();

      if (!bucketResult.exists) {
        toast.info("Setting up storage...");
        await fetch("/api/storage", { method: "POST" });
      }

      toast.info("Processing image...");
      const compressedFile = await compressImage(file);

      const fileExt = "jpg";
      const fileName = `${school.id}-logo.${fileExt}`;

      console.debug("Starting upload to bucket...");

      let uploadData = await supabase.storage
        .from("school-logos")
        .upload(fileName, compressedFile, {
          upsert: true,
          contentType: "image/jpeg",
        });

      console.debug("Upload result:", uploadData);

      let { data, error } = uploadData;

      if (error && error.message.includes("bucket")) {
        console.debug("Bucket not found, attempting to create...");
        await supabase.storage.createBucket("school-logos", {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });

        uploadData = await supabase.storage
          .from("school-logos")
          .upload(fileName, compressedFile, {
            upsert: true,
            contentType: "image/jpeg",
          });

        data = uploadData.data;
        error = uploadData.error;
      }

      if (error) {
        console.error("Storage error:", error);
        toast.error(`Upload failed: ${error.message}`);
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("school-logos").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("schools")
        .update({ logo_url: publicUrl })
        .eq("id", school.id);

      if (updateError) {
        console.error("Update error:", updateError);
      } else {
        await refreshSchool();
      }

      setLogoUrl(publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error("Failed to upload logo. Check console for details.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadSignature = async (file: File, type: SignatureType) => {
    if (!school?.id) return;
    setUploadingLogo(true);
    try {
      const compressedFile = await compressImage(file);
      const fileExt = "png";
      const fileName = `${school.id}-${type}.${fileExt}`;

      let uploadData = await supabase.storage
        .from("school-logos")
        .upload(fileName, compressedFile, {
          upsert: true,
          contentType: "image/png",
        });

      let { data, error } = uploadData;

      if (error && error.message.includes("bucket")) {
        await supabase.storage.createBucket("school-logos", {
          public: true,
          fileSizeLimit: 1048576,
          allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        });
        uploadData = await supabase.storage
          .from("school-logos")
          .upload(fileName, compressedFile, {
            upsert: true,
            contentType: "image/png",
          });
        data = uploadData.data;
        error = uploadData.error;
      }

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("school-logos").getPublicUrl(fileName);

      const updateField =
        type === "signature_headteacher"
          ? { signature_headteacher_url: publicUrl }
          : { signature_class_teacher_url: publicUrl };

      const { error: updateError } = await supabase
        .from("schools")
        .update(updateField)
        .eq("id", school.id);

      if (updateError) throw updateError;
      await refreshSchool();
      toast.success(
        `${type === "signature_headteacher" ? "Head teacher" : "Class teacher"} signature uploaded`,
      );
    } catch (err) {
      console.error("Signature upload error:", err);
      toast.error("Failed to upload signature");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleStageChange = async (stage: FeatureStage) => {
    if (!school?.id || stage === selectedStage) return;
    try {
      const { error } = await supabase
        .from("schools")
        .update({ feature_stage: stage })
        .eq("id", school.id);
      if (error) throw error;
      setSelectedStage(stage);
      await refreshSchool();
      toast.success(`Stage updated to ${FEATURE_STAGES[stage].label}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Could not update stage",
      );
    }
  };

  const saveSchoolSettings = async () => {
    if (!school?.id) return;
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          name: schoolData.name,
          district: schoolData.district,
          phone: schoolData.phone || null,
          email: schoolData.email || null,
        })
        .eq("id", school.id);
      if (error) throw error;
      toast.success("Settings saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-[#191c1d] mb-6">
          School Logo
        </h2>
        <div className="flex items-center gap-6 mb-6">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="School Logo"
                width={96}
                height={96}
                className="w-full h-full object-contain"
              />
            ) : (
              <MaterialIcon className="text-4xl text-gray-300">
                school
              </MaterialIcon>
            )}
          </div>
          <div>
            <label className="btn btn-secondary cursor-pointer">
              <MaterialIcon icon="upload" className="text-lg" />
              {uploadingLogo ? "Uploading..." : "Upload Logo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploadingLogo}
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">
              PNG, JPG up to 5MB - Auto-compressed
            </p>
          </div>
        </div>

        {/* Report Signatures */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-[#191c1d] mb-4">
            Report Signatures
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Add digital signatures to auto-fill on report cards
          </p>

          <div className="grid grid-cols-2 gap-6">
            {/* Head Teacher Signature */}
            <div>
              <p className="text-sm font-medium mb-2">Head Teacher Signature</p>
              <div className="h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                {(school as any)?.signature_headteacher_url ? (
                  <Image
                    src={(school as any).signature_headteacher_url}
                    alt="Head Teacher Signature"
                    width={150}
                    height={60}
                    className="h-full w-auto object-contain"
                  />
                ) : (
                  <MaterialIcon className="text-3xl text-gray-300">
                    draw
                  </MaterialIcon>
                )}
              </div>
              <label className="btn btn-secondary cursor-pointer mt-2 w-full justify-center">
                <MaterialIcon icon="upload" className="text-lg" />
                {uploadingLogo ? "Uploading..." : "Upload Signature"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadSignature(file, "signature_headteacher");
                  }}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
            </div>

            {/* Class Teacher Signature */}
            <div>
              <p className="text-sm font-medium mb-2">
                Class Teacher Signature
              </p>
              <div className="h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                {(school as any)?.signature_class_teacher_url ? (
                  <Image
                    src={(school as any).signature_class_teacher_url}
                    alt="Class Teacher Signature"
                    width={150}
                    height={60}
                    className="h-full w-auto object-contain"
                  />
                ) : (
                  <MaterialIcon className="text-3xl text-gray-300">
                    draw
                  </MaterialIcon>
                )}
              </div>
              <label className="btn btn-secondary cursor-pointer mt-2 w-full justify-center">
                <MaterialIcon icon="upload" className="text-lg" />
                {uploadingLogo ? "Uploading..." : "Upload Signature"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadSignature(file, "signature_class_teacher");
                  }}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-[#191c1d] mb-6">
          School Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#191c1d] mb-2 block">
              School Name
            </label>
            <input
              type="text"
              value={schoolData.name}
              onChange={(e) =>
                setSchoolData({ ...schoolData, name: e.target.value })
              }
              className="input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                District
              </label>
              <input
                type="text"
                value={schoolData.district}
                onChange={(e) =>
                  setSchoolData({ ...schoolData, district: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                Sub-county
              </label>
              <input
                type="text"
                value={schoolData.subcounty}
                onChange={(e) =>
                  setSchoolData({ ...schoolData, subcounty: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                Phone
              </label>
              <input
                type="tel"
                value={schoolData.phone}
                onChange={(e) =>
                  setSchoolData({ ...schoolData, phone: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                Email
              </label>
              <input
                type="email"
                value={schoolData.email}
                onChange={(e) =>
                  setSchoolData({ ...schoolData, email: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              onClick={saveSchoolSettings}
              disabled={saving}
              className="btn btn-primary"
            >
              <MaterialIcon icon="save" className="text-lg" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#191c1d]">
              Package stage
            </h2>
            <p className="text-sm text-[#5c6670]">
              Disable modules that fall outside your current package.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#2E9448]">
            {selectedStage}
          </span>
        </div>
        <div className="grid gap-3">
          {stageOrder.map((stageKey) => {
            const stage = FEATURE_STAGES[stageKey];
            const isActive = stageKey === selectedStage;
            return (
              <button
                key={stageKey}
                onClick={() => handleStageChange(stageKey)}
                disabled={savingStage || isActive}
                className={`w-full text-left rounded-2xl border px-4 py-4 transition ${
                  isActive
                    ? "border-[#2E9448] bg-[#eaf4ed]"
                    : "border-[#e1e7f0] bg-white hover:border-[#2E9448]/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#191c1d]">
                      {stage.label}
                    </p>
                    <p className="text-xs text-[#5c6670] mt-1">
                      {stage.description}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-semibold text-[#2E9448]">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
