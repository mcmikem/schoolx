import {
  STUDENT_PHOTO_OUTPUT_TYPES,
  compressStudentPhoto,
  compressedPhotoExtension,
  extractStorageObjectPath,
  replacePhotoExtension,
} from "../lib/student-photos";

describe("Student photo encoding helpers", () => {
  it("prefers WebP output, then JPEG", () => {
    expect(STUDENT_PHOTO_OUTPUT_TYPES).toEqual(["image/webp", "image/jpeg"]);
  });

  it("maps encodings to file extensions", () => {
    expect(compressedPhotoExtension("image/webp")).toBe("webp");
    expect(compressedPhotoExtension("image/jpeg")).toBe("jpg");
  });

  it("replaces file extensions without touching the base name", () => {
    expect(replacePhotoExtension("STU001.jpg", "webp")).toBe("STU001.webp");
    expect(replacePhotoExtension("STU001.jpeg", "webp")).toBe("STU001.webp");
    expect(replacePhotoExtension("STU001", "webp")).toBe("STU001.webp");
  });
});

describe("extractStorageObjectPath", () => {
  it("extracts the object path from a public storage URL", () => {
    expect(
      extractStorageObjectPath(
        "https://xyz.supabase.co/storage/v1/object/public/student-photos/school-1/students/abc.webp",
      ),
    ).toBe("school-1/students/abc.webp");
  });

  it("returns null for data URLs, blanks, and foreign URLs", () => {
    expect(extractStorageObjectPath(null)).toBeNull();
    expect(extractStorageObjectPath("")).toBeNull();
    expect(extractStorageObjectPath("data:image/jpeg;base64,xxx")).toBeNull();
    expect(extractStorageObjectPath("https://example.com/photo.jpg")).toBeNull();
  });
});

describe("compressStudentPhoto encoding", () => {
  const originalImage = window.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = document.createElement;

  function mockEncoder(sizes: Record<string, number | null>) {
    const seenMimes: string[] = [];
    (URL as unknown as Record<string, unknown>).createObjectURL = jest.fn(() => "blob:photo");
    (URL as unknown as Record<string, unknown>).revokeObjectURL = jest.fn();

    class FakeImage {
      width = 2000;
      height = 1000;
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }
    (window as unknown as Record<string, unknown>).Image = FakeImage;

    jest.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName !== "canvas") {
        return originalCreateElement.call(document, tagName);
      }
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (callback: (blob: Blob | null) => void, mimeType?: string) => {
          const mime = mimeType || "image/jpeg";
          seenMimes.push(mime);
          const size = sizes[mime];
          if (size === undefined || size === null) {
            callback(null);
            return;
          }
          callback(new Blob(["x".repeat(size)], { type: mime }));
        },
      };
    }) as unknown as typeof document.createElement);

    return seenMimes;
  }

  afterEach(() => {
    (window as unknown as Record<string, unknown>).Image = originalImage;
    (URL as unknown as Record<string, unknown>).createObjectURL = originalCreateObjectURL;
    (URL as unknown as Record<string, unknown>).revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  it("encodes WebP first", async () => {
    mockEncoder({ "image/webp": 100, "image/jpeg": 200 });
    const file = new File(["original"], "STU001.png", { type: "image/png" });

    const compressed = await compressStudentPhoto(file);

    expect(compressed.type).toBe("image/webp");
    expect(compressed.name).toBe("STU001.webp");
  });

  it("falls back to JPEG when WebP encoding is unavailable", async () => {
    const seenMimes = mockEncoder({ "image/webp": null, "image/jpeg": 200 });
    const file = new File(["original"], "STU001.png", { type: "image/png" });

    const compressed = await compressStudentPhoto(file);

    expect(seenMimes).toContain("image/jpeg");
    expect(compressed.type).toBe("image/jpeg");
    expect(compressed.name).toBe("STU001.jpg");
  });
});
