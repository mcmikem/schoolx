// External Storage Service for cPanel/big files
// This handles photos, PDFs, and large files via external storage

const EXTERNAL_STORAGE_BASE =
  process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL || "";

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadToExternalStorage(
  file: File,
  folder: "students" | "staff" | "reports" | "documents",
  filename: string,
): Promise<UploadResult> {
  try {
    // For now, we'll simulate the upload
    // In production, this would POST to your cPanel storage endpoint
    // Example: POST to https://storage.yourdomain.com/upload

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    formData.append("filename", filename);

    // Check if external storage is configured
    if (!EXTERNAL_STORAGE_BASE) {
      // Fallback: generate a placeholder URL
      const placeholderUrl = `${EXTERNAL_STORAGE_BASE}/${folder}/${filename}`;
      return {
        success: true,
        url: placeholderUrl,
      };
    }

    // In production, uncomment this:
    // const response = await fetch(`${EXTERNAL_STORAGE_BASE}/upload`, {
    //   method: 'POST',
    //   body: formData,
    // });
    //
    // if (!response.ok) throw new Error('Upload failed');
    // const data = await response.json();
    // return { success: true, url: data.url };

    // Simulated response for demo
    const simulatedUrl = `https://storage.omuto.org/${folder}/${Date.now()}-${filename}`;
    return {
      success: true,
      url: simulatedUrl,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export function getStorageUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${EXTERNAL_STORAGE_BASE}/${path}`;
}

export function getStudentPhotoUrl(
  photoPath: string | null | undefined,
): string {
  if (!photoPath) return "";
  return getStorageUrl(photoPath);
}

export async function deleteFromExternalStorage(
  path: string,
): Promise<boolean> {
  try {
    if (!EXTERNAL_STORAGE_BASE) return true;

    // In production:
    // await fetch(`${EXTERNAL_STORAGE_BASE}/delete`, {
    //   method: 'DELETE',
    //   body: JSON.stringify({ path }),
    // });

    return true;
  } catch {
    return false;
  }
}

// Image optimization helpers
export function getOptimizedImageUrl(
  url: string,
  options: { width?: number; height?: number; quality?: number } = {},
): string {
  if (!url) return "";

  // If using external storage with image optimization, append params
  if (EXTERNAL_STORAGE_BASE && url.includes(EXTERNAL_STORAGE_BASE)) {
    const params = new URLSearchParams();
    if (options.width) params.set("w", options.width.toString());
    if (options.height) params.set("h", options.height.toString());
    if (options.quality) params.set("q", options.quality.toString());

    const query = params.toString();
    return query ? `${url}?${query}` : url;
  }

  return url;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file: File, type: "image" | "document"): boolean {
  if (file.size > MAX_FILE_SIZE) return false;

  if (type === "image") return ALLOWED_IMAGE_TYPES.includes(file.type);
  if (type === "document") return ALLOWED_DOCUMENT_TYPES.includes(file.type);

  return false;
}
