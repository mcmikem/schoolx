import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validateStudentPhoto(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use JPG, PNG, WebP, or GIF for passport photos.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Passport photo must be smaller than 5MB.");
  }
}

export async function compressStudentPhoto(
  file: File,
  maxWidth = 700,
  maxHeight = 700,
): Promise<File> {
  return await new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const image = new window.Image();

    image.onload = () => {
      let { width, height } = image;

      if (width > height && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      } else if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      context?.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        0.86,
      );
    };

    image.src = URL.createObjectURL(file);
  });
}

export async function uploadStudentPhoto(options: {
  file: File;
  schoolId: string;
  studentId?: string;
}) {
  validateStudentPhoto(options.file);
  const compressedFile = await compressStudentPhoto(options.file);
  const recordId = options.studentId || `draft-${Date.now()}`;
  const filePath = `${options.schoolId}/students/${recordId}.jpg`;

  let uploadResult = await supabase.storage
    .from("school-logos")
    .upload(filePath, compressedFile, {
      upsert: true,
      contentType: "image/jpeg",
    });

  if (uploadResult.error && uploadResult.error.message.includes("bucket")) {
    await supabase.storage.createBucket("school-logos", {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
    });

    uploadResult = await supabase.storage
      .from("school-logos")
      .upload(filePath, compressedFile, {
        upsert: true,
        contentType: "image/jpeg",
      });
  }

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("school-logos").getPublicUrl(filePath);

  return { publicUrl, filePath };
}