import { formatUgandaPhone, checkSmsDailyLimit, checkSmsQuota } from "../lib/africas-talking";
import { detectConsecutiveAbsenceAlerts } from "../lib/operations";
import { sendParentPortalCredentials, sendWhatsApp } from "../lib/whatsapp";

function buildMockClient() {
  const client: Record<string, jest.Mock> = {} as any;
  client.from = jest.fn(() => client);
  client.select = jest.fn(() => client);
  client.insert = jest.fn(() => client);
  client.update = jest.fn(() => client);
  client.eq = jest.fn(() => client);
  client.gte = jest.fn(() => client);
  client.order = jest.fn(() => client);
  client.limit = jest.fn(() => client);
  client.not = jest.fn(() => client);
  client.single = jest.fn().mockResolvedValue({ data: null, error: null });
  client.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  client.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  return client;
}

const mockClient = buildMockClient();

const mockCreateClient = jest.fn(() => mockClient);
jest.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("formatUgandaPhone", () => {
  test('formats "0700000000" (local format)', () => {
    expect(formatUgandaPhone("0700000000")).toBe("+256700000000");
  });

  test('formats "+256700000000" (international format)', () => {
    expect(formatUgandaPhone("+256700000000")).toBe("+256700000000");
  });

  test('formats "256-700-000-000" (dashed format)', () => {
    expect(formatUgandaPhone("256-700-000-000")).toBe("+256700000000");
  });

  test("throws on invalid short number", () => {
    expect(() => formatUgandaPhone("123")).toThrow("Invalid phone number format");
  });

  test("throws on invalid country code length", () => {
    expect(() => formatUgandaPhone("25670000000")).toThrow("must be 12 digits");
  });

  test("formats 9-digit number without prefix", () => {
    expect(formatUgandaPhone("700000000")).toBe("+256700000000");
  });
});

function resetMocks() {
  jest.clearAllMocks();
  mockCreateClient.mockImplementation(() => mockClient);
  Object.assign(mockClient, buildMockClient());
}

describe("checkSmsDailyLimit", () => {
  beforeEach(() => {
    resetMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  test("returns true when under limit", async () => {
    mockClient.gte.mockResolvedValue({ count: 10, error: null });
    const result = await checkSmsDailyLimit("school-1", 5);
    expect(result).toBe(true);
  });

  test("returns false when limit exceeded", async () => {
    mockClient.gte.mockResolvedValue({ count: 498, error: null });
    const result = await checkSmsDailyLimit("school-1", 5);
    expect(result).toBe(false);
  });

  test("returns true when supabase config missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await checkSmsDailyLimit("school-1", 5);
    expect(result).toBe(true);
  });
});

describe("checkSmsQuota", () => {
  beforeEach(() => {
    resetMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  test("allows when quota has room", async () => {
    mockClient.maybeSingle.mockResolvedValue({ data: { monthly_limit: 500, monthly_used: 50 }, error: null });
    const result = await checkSmsQuota("school-1", 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(450);
    expect(result.limit).toBe(500);
    expect(result.used).toBe(50);
  });

  test("denies when quota exceeded", async () => {
    mockClient.maybeSingle.mockResolvedValue({ data: { monthly_limit: 500, monthly_used: 495 }, error: null });
    const result = await checkSmsQuota("school-1", 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(5);
  });

  test("creates quota row if none exists", async () => {
    mockClient.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { monthly_limit: 500, monthly_used: 0 }, error: null });
    mockClient.single.mockResolvedValue({ data: { monthly_limit: 500, monthly_used: 0 }, error: null });

    const result = await checkSmsQuota("school-1", 10);
    expect(result.allowed).toBe(true);
  });

  test("returns true when supabase config missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await checkSmsQuota("school-1", 10);
    expect(result.allowed).toBe(true);
  });
});

describe("WhatsApp sendWhatsApp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test("returns failure (not fake demo success) when not configured outside development", async () => {
    const origToken = process.env.WHATSAPP_BUSINESS_TOKEN;
    const origId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const result = await sendWhatsApp("0700000000", "Hello");
    expect(result.success).toBe(false);
    expect(result.demo).toBeUndefined();
    expect(result.error).toContain("not configured");

    process.env.WHATSAPP_BUSINESS_TOKEN = origToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = origId;
  });

  test("parent portal credentials use a template message when configured", async () => {
    const origToken = process.env.WHATSAPP_BUSINESS_TOKEN;
    const origId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const origName = process.env.WHATSAPP_PARENT_PORTAL_TEMPLATE_NAME;
    process.env.WHATSAPP_BUSINESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-id";
    process.env.WHATSAPP_PARENT_PORTAL_TEMPLATE_NAME = "parent_portal_credentials";

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wa-mock" }] }),
    });

    const result = await sendParentPortalCredentials({
      parentName: "Jane Doe",
      parentPhone: "0700000000",
      studentName: "John Doe",
      password: "Sm!secretA9",
      portalUrl: "https://app.skoolmate.org/parent-portal",
      schoolName: "Test School",
    });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("/phone-id/messages");
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("parent_portal_credentials");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "Jane Doe" },
      { type: "text", text: "0700000000" },
      { type: "text", text: "Sm!secretA9" },
      { type: "text", text: "https://app.skoolmate.org/parent-portal" },
      { type: "text", text: "Test School" },
    ]);

    process.env.WHATSAPP_BUSINESS_TOKEN = origToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = origId;
    process.env.WHATSAPP_PARENT_PORTAL_TEMPLATE_NAME = origName;
  });

  test("template send failure surfaces a real error (not a fake success)", async () => {
    const origToken = process.env.WHATSAPP_BUSINESS_TOKEN;
    const origId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const origName = process.env.WHATSAPP_PARENT_PORTAL_TEMPLATE_NAME;
    process.env.WHATSAPP_BUSINESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-id";
    process.env.WHATSAPP_PARENT_PORTAL_TEMPLATE_NAME = "parent_portal_credentials";

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Message undeliverable" } }),
    });

    const result = await sendParentPortalCredentials({
      parentName: "Jane Doe",
      parentPhone: "0700000000",
      studentName: "John Doe",
      password: "Sm!secretA9",
      portalUrl: "https://app.skoolmate.org/parent-portal",
      schoolName: "Test School",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Message undeliverable");
    expect(result.shareLink).toBeTruthy();

    process.env.WHATSAPP_BUSINESS_TOKEN = origToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = origId;
    process.env.WHATSAPP_PARENT_PORTAL_TEMPLATE_NAME = origName;
  });
});

describe("detectConsecutiveAbsenceAlerts", () => {
  test("flags student absent for 3 consecutive days when threshold is 3", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "John", last_name: "Doe", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-06-04", status: "absent" },
        { student_id: "s1", date: "2026-06-03", status: "absent" },
        { student_id: "s1", date: "2026-06-02", status: "absent" },
        { student_id: "s1", date: "2026-06-01", status: "present" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      studentId: "s1",
      consecutiveAbsentDays: 3,
      shouldSendSms: true,
    });
    expect(result[0].smsMessage).toContain("3 consecutive");
  });

  test("does not flag student when absence is below threshold", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "John", last_name: "Doe", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-06-04", status: "absent" },
        { student_id: "s1", date: "2026-06-03", status: "present" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    expect(result).toHaveLength(0);
  });

  test("marks shouldSendSms false when trigger is inactive", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "John", last_name: "Doe", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-06-04", status: "absent" },
        { student_id: "s1", date: "2026-06-03", status: "absent" },
        { student_id: "s1", date: "2026-06-02", status: "absent" },
      ],
      trigger: { threshold_days: 3, is_active: false },
    });

    expect(result).toHaveLength(1);
    expect(result[0].shouldSendSms).toBe(false);
  });

  test("handles multiple students independently", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [
        { id: "s1", first_name: "Alice", last_name: "A", parent_phone: "0770000001" },
        { id: "s2", first_name: "Bob", last_name: "B", parent_phone: "0770000002" },
      ],
      attendance: [
        { student_id: "s1", date: "2026-06-04", status: "absent" },
        { student_id: "s1", date: "2026-06-03", status: "absent" },
        { student_id: "s1", date: "2026-06-02", status: "absent" },
        { student_id: "s2", date: "2026-06-04", status: "present" },
        { student_id: "s2", date: "2026-06-03", status: "absent" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe("s1");
  });

  test("handles empty attendance gracefully", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "John", last_name: "Doe", parent_phone: "0770000000" }],
      attendance: [],
      trigger: { threshold_days: 3, is_active: true },
    });

    expect(result).toHaveLength(0);
  });

  test("defaults threshold to 3 when trigger is undefined", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "John", last_name: "Doe", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-06-04", status: "absent" },
        { student_id: "s1", date: "2026-06-03", status: "absent" },
        { student_id: "s1", date: "2026-06-02", status: "absent" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].consecutiveAbsentDays).toBe(3);
  });
});
