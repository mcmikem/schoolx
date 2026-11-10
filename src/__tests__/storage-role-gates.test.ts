/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRole: { value: string } = { value: "parent" };
const mockCreateClient: any = jest.fn();
const mockStorageClient: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "user-a", role: mockRole.value } },
  }),
  supabaseClientOptions: () => ({}),
}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function makeRequest(path: string, file?: File): NextRequest {
  const form = new FormData();
  form.set("path", path);
  if (file) form.set("file", file);
  return new NextRequest("http://localhost/api/storage", { method: "POST", body: form });
}

describe("service-role storage API role gates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "parent";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockStorageClient.mockReturnValue({
      upload: async () => ({ data: { path: "schools/school-a/files/sample.pdf" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://example.test/public" } }),
    });
    mockCreateClient.mockReturnValue({
      storage: {
        createBucket: async () => ({ error: null }),
        from: (...args: unknown[]) => mockStorageClient(...args),
        listBuckets: async () => ({ data: [], error: null }),
      },
    });
  });

  it("denies parents from uploading school files before creating a service client", async () => {
    const { POST } = await import("@/app/api/storage/route");
    const response = await POST(
      makeRequest("files", new File(["private"], "document.pdf", { type: "application/pdf" })),
    );
    expect(response.status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("denies teachers from uploading to the public school-logo bucket", async () => {
    mockRole.value = "teacher";
    const { POST } = await import("@/app/api/storage/route");
    const response = await POST(makeRequest("logos", new File(["%PDF-1.4"], "logo.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
