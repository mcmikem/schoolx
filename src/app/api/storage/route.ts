import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiError, requireUserWithSchool } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const STORAGE_BUCKETS = {
  "school-logos": {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as string[],
  },
  "school-files": {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  },
} as const;

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 255);
}

function sanitizePathSegment(segment: string): string {
  return sanitizeFileName(segment).replace(/^_+|_+$/g, "");
}

function sanitizeRelativePath(path: string): string {
  return path
    .split("/")
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join("/");
}

function getBucketName(path: string): keyof typeof STORAGE_BUCKETS {
  return path.startsWith("logos") ? "school-logos" : "school-files";
}

function buildScopedPath(schoolId: string, rawPath: string, fileName: string): string {
  const bucketName = getBucketName(rawPath);
  const relativePath = sanitizeRelativePath(rawPath.replace(/^logos\/?/, "").replace(/^files\/?/, ""));
  const basePath = bucketName === "school-logos" ? `schools/${schoolId}/logos` : `schools/${schoolId}/files`;

  return [basePath, relativePath, sanitizeFileName(fileName)].filter(Boolean).join("/");
}

async function ensureBucketExists(supabaseAdmin: any, bucketName: keyof typeof STORAGE_BUCKETS) {
  const bucketConfig = STORAGE_BUCKETS[bucketName];
  const { error } = await supabaseAdmin.storage.createBucket(bucketName, bucketConfig);

  if (error && !error.message.includes("already exists")) {
    throw error;
  }
}

function hasSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (offset + signature.length > bytes.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function detectMimeType(bytes: Uint8Array): string | null {
  if (hasSignature(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    hasSignature(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    hasSignature(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  )
    return "image/gif";
  if (hasSignature(bytes, [0x52, 0x49, 0x46, 0x46]) && hasSignature(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  if (hasSignature(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (hasSignature(bytes, [0x50, 0x4b, 0x03, 0x04])) return "ooxml";
  if (hasSignature(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole2";
  return null;
}

function sameContentFamily(declaredType: string, detectedType: string): boolean {
  if (detectedType === "ooxml") return declaredType.startsWith("application/vnd.openxmlformats-officedocument");
  if (detectedType === "ole2")
    return declaredType === "application/msword" || declaredType === "application/vnd.ms-excel";
  return declaredType === detectedType;
}

async function validateFile(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`;
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type "${file.type}" is not allowed. Allowed types: images, PDFs, documents`;
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedType = detectMimeType(header);

  if (!detectedType) {
    return "File content could not be verified. Upload a valid image, PDF, or document.";
  }

  if (!sameContentFamily(file.type, detectedType)) {
    return "File content does not match its declared type. Please re-export and try again.";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!supabaseServiceKey) {
      return apiError("Server configuration error", 500);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const path = (formData.get("path") as string) || "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!file) {
      await ensureBucketExists(supabaseAdmin, "school-logos");
      await ensureBucketExists(supabaseAdmin, "school-files");

      return NextResponse.json({
        success: true,
        exists: true,
        buckets: Object.keys(STORAGE_BUCKETS),
      });
    }

    const validationError = await validateFile(file);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const bucketName = getBucketName(path);
    const sanitizedPath = buildScopedPath(auth.context.schoolId || "unknown-school", path, file.name);

    const { data, error } = await supabaseAdmin.storage.from(bucketName).upload(sanitizedPath, file, {
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      if (error.message.includes("Bucket") && error.message.includes("not found")) {
        try {
          await ensureBucketExists(supabaseAdmin, bucketName);
        } catch (bucketError) {
          logger.error("Create bucket error:", bucketError);
          return apiError(bucketError instanceof Error ? bucketError.message : "Failed to create storage bucket", 500);
        }

        const retryUpload = await supabaseAdmin.storage.from(bucketName).upload(sanitizedPath, file, {
          upsert: false,
          contentType: file.type,
        });

        if (retryUpload.error) {
          logger.error("Retry upload error:", retryUpload.error);
          return apiError(retryUpload.error.message || "Failed to upload file", 500);
        }

        const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(retryUpload.data.path);

        return NextResponse.json({
          success: true,
          path: retryUpload.data.path,
          url: urlData.publicUrl,
        });
      }

      logger.error("Upload error:", error);
      return apiError(error.message || "Failed to upload file", 500);
    }

    const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      path: data.path,
      url: urlData.publicUrl,
    });
  } catch (error) {
    logger.error("Server error:", error);
    return apiError(error instanceof Error ? error.message : "Failed to upload file", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    if (!supabaseServiceKey) {
      return apiError("Server configuration error", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketNames = new Set((buckets || []).map((bucket) => bucket.name));

    return NextResponse.json({
      success: true,
      exists: bucketNames.has("school-logos") && bucketNames.has("school-files"),
      buckets: buckets?.map((b) => ({ id: b.id, name: b.name, public: b.public })),
    });
  } catch (error) {
    logger.error("Server error:", error);
    return apiError(error instanceof Error ? error.message : "Failed to list buckets", 500);
  }
}
