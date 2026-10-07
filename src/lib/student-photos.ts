import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withTimeout } from "./hooks/utils";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Preferred upload encoding, in order. WebP is usually much smaller than JPEG
 * for portraits at comparable quality; JPEG remains as the fallback for
 * browsers/devices whose canvas cannot encode WebP.
 */
export const STUDENT_PHOTO_OUTPUT_TYPES = ["image/webp", "image/jpeg"] as const;

export function compressedPhotoExtension(mimeType: string): string {
  return mimeType === "image/webp" ? "webp" : "jpg";
}

export function replacePhotoExtension(fileName: string, extension: string): string {
  const base = fileName.includes(".") ? fileName.replace(/\.[^.]+$/, "") : fileName;
  return `${base}.${extension}`;
}

/**
 * Storage object path behind a public URL, e.g.
 * `https://…/storage/v1/object/public/student-photos/<school>/<file>` →
 * `<school>/<file>`. Returns null for data-URLs, blank values, or foreign URLs.
 */
export function extractStorageObjectPath(
  publicUrl: string | null | undefined,
  bucket = "student-photos",
): string | null {
  if (!publicUrl || publicUrl.startsWith("data:")) return null;
  const marker = `${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  const path = publicUrl.slice(index + marker.length).split("?")[0];
  return path || null;
}

/**
 * Delete the previous photo object after a replacement upload, so a format
 * change (`.jpg` → `.webp`) does not leave the old file orphaned in the
 * bucket. Best-effort: cleanup failures are logged, never thrown.
 *
 * Safety rules: same bucket, different path, and the same top-level folder
 * (the school id), so a stray URL can never delete another school's file.
 */
export async function removePreviousPhoto(
  previousPhotoUrl: string | null | undefined,
  newFilePath: string,
  bucket = "student-photos",
): Promise<void> {
  try {
    const oldPath = extractStorageObjectPath(previousPhotoUrl, bucket);
    if (!oldPath || oldPath === newFilePath) return;
    if (oldPath.split("/")[0] !== newFilePath.split("/")[0]) return;
    const { error } = await withTimeout<{ error: { message: string } | null }>(
      supabase.storage
        .from(bucket)
        .remove([oldPath])
        .then((r) => ({ error: r.error ? { message: r.error.message } : null })),
      20000,
      { error: { message: "Timed out removing the replaced photo; the old file may still be in storage." } },
    );
    if (error) {
      logger.warn("Failed to remove replaced photo:", error.message);
    }
  } catch (err) {
    logger.warn("Failed to remove replaced photo:", err instanceof Error ? err.message : err);
  }
}

type StorageUploadResult = {
  data: { path: string } | null;
  error: { message: string } | null;
};

// A stalled upload must fail the file, not the whole batch: without a
// deadline one hung request freezes a 300-photo queue with no way to skip it.
// Re-running the batch afterwards is safe because uploads upsert by path.
const UPLOAD_TIMEOUT_MS = 60000;
const UPLOAD_TIMEOUT_RESULT: StorageUploadResult = {
  data: null,
  error: { message: "Photo upload timed out. Check the connection and retry this file." },
};

export function validateStudentPhoto(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use JPG, PNG, WebP, or GIF for passport photos.");
  }
}

function validateCompressedStudentPhoto(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Image is still larger than 5MB after compression. Try a smaller or lower-resolution photo.");
  }
}

async function renderCompressedBlob(options: {
  image: HTMLImageElement;
  width: number;
  height: number;
  quality: number;
  mimeType: string;
}) {
  return await new Promise<Blob | null>((resolve) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.max(1, Math.round(options.width));
    canvas.height = Math.max(1, Math.round(options.height));
    context?.drawImage(options.image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(resolve, options.mimeType, options.quality);
  });
}

function buildCompressedPhotoFile(blob: Blob, file: File, mimeType: string): File {
  return new File([blob], replacePhotoExtension(file.name, compressedPhotoExtension(mimeType)), {
    type: mimeType,
    lastModified: Date.now(),
  });
}

export async function compressStudentPhoto(file: File, maxWidth = 1600, maxHeight = 1600): Promise<File> {
  return await new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      let { width, height } = image;

      if (width > height && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      } else if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      const attempts = [
        { scale: 1, quality: 0.88 },
        { scale: 0.9, quality: 0.82 },
        { scale: 0.8, quality: 0.76 },
        { scale: 0.7, quality: 0.7 },
        { scale: 0.6, quality: 0.64 },
        { scale: 0.5, quality: 0.58 },
      ];

      const run = async () => {
        for (const mimeType of STUDENT_PHOTO_OUTPUT_TYPES) {
          for (const attempt of attempts) {
            const blob = await renderCompressedBlob({
              image,
              width: width * attempt.scale,
              height: height * attempt.scale,
              quality: attempt.quality,
              mimeType,
            });

            if (!blob) {
              // A null blob on WebP means this browser cannot encode it.
              // Stop wasting attempts and fall through to JPEG.
              break;
            }

            const compressedFile = buildCompressedPhotoFile(blob, file, mimeType);

            if (compressedFile.size <= MAX_FILE_SIZE_BYTES) {
              URL.revokeObjectURL(objectUrl);
              resolve(compressedFile);
              return;
            }
          }
        }

        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            "Image could not be compressed below 5MB as WebP or JPEG. Try a smaller or lower-resolution photo.",
          ),
        );
      };

      void run();
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to process image file."));
    };

    image.src = objectUrl;
  });
}

export async function uploadStudentPhoto(options: {
  file: File;
  schoolId: string;
  studentId?: string;
  maxWidth?: number;
  maxHeight?: number;
}) {
  validateStudentPhoto(options.file);
  const compressedFile = await compressStudentPhoto(options.file, options.maxWidth, options.maxHeight);
  validateCompressedStudentPhoto(compressedFile);
  const recordId = options.studentId || `draft-${Date.now()}`;
  const extension = compressedPhotoExtension(compressedFile.type);
  const filePath = `${options.schoolId}/students/${recordId}.${extension}`;

  let uploadResult = await withTimeout<StorageUploadResult>(
    supabase.storage.from("student-photos").upload(filePath, compressedFile, {
      upsert: true,
      contentType: compressedFile.type,
    }),
    UPLOAD_TIMEOUT_MS,
    UPLOAD_TIMEOUT_RESULT,
  );

  if (uploadResult.error && uploadResult.error.message.includes("bucket")) {
    await supabase.storage.createBucket("student-photos", {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
    });

    uploadResult = await withTimeout<StorageUploadResult>(
      supabase.storage.from("student-photos").upload(filePath, compressedFile, {
        upsert: true,
        contentType: compressedFile.type,
      }),
      UPLOAD_TIMEOUT_MS,
      UPLOAD_TIMEOUT_RESULT,
    );
  }

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("student-photos").getPublicUrl(filePath);

  return { publicUrl, filePath };
}
