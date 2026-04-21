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
}

function validateCompressedStudentPhoto(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      "Image is still larger than 5MB after compression. Try a smaller or lower-resolution photo.",
    );
  }
}

async function renderCompressedBlob(options: {
  image: HTMLImageElement;
  width: number;
  height: number;
  quality: number;
}) {
  return await new Promise<Blob | null>((resolve) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.max(1, Math.round(options.width));
    canvas.height = Math.max(1, Math.round(options.height));
    context?.drawImage(options.image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(resolve, "image/jpeg", options.quality);
  });
}

export async function compressStudentPhoto(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
): Promise<File> {
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
        for (const attempt of attempts) {
          const blob = await renderCompressedBlob({
            image,
            width: width * attempt.scale,
            height: height * attempt.scale,
            quality: attempt.quality,
          });

          if (!blob) {
            continue;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            {
              type: "image/jpeg",
              lastModified: Date.now(),
            },
          );

          if (compressedFile.size <= MAX_FILE_SIZE_BYTES) {
            URL.revokeObjectURL(objectUrl);
            resolve(compressedFile);
            return;
          }
        }

        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            "Image could not be compressed below 5MB. Try a smaller or lower-resolution photo.",
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
}) {
  validateStudentPhoto(options.file);
  const compressedFile = await compressStudentPhoto(options.file);
  validateCompressedStudentPhoto(compressedFile);
  const recordId = options.studentId || `draft-${Date.now()}`;
  const filePath = `${options.schoolId}/students/${recordId}.jpg`;

  let uploadResult = await supabase.storage
    .from("student-photos")
    .upload(filePath, compressedFile, {
      upsert: true,
      contentType: "image/jpeg",
    });

  if (uploadResult.error && uploadResult.error.message.includes("bucket")) {
    await supabase.storage.createBucket("student-photos", {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
    });

    uploadResult = await supabase.storage
      .from("student-photos")
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
  } = supabase.storage.from("student-photos").getPublicUrl(filePath);

  return { publicUrl, filePath };
}