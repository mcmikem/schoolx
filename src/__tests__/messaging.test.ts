/**
 * Behavioural tests for the messaging channel resolver.
 *
 * The resolver is what lets a school move from SMS to WhatsApp without any
 * automation being rewritten, so the important properties are:
 *   - WhatsApp is preferred when it is actually configured
 *   - a school pinned to SMS stays on SMS even when WhatsApp exists
 *   - a school pinned to a channel that isn't configured falls back honestly
 *   - an unconfigured channel reports failure, never a false success
 */
const sendWhatsAppTextMessage = jest.fn();
const sendWhatsAppTemplateMessage = jest.fn();
const sendAfricasTalkingSMSWithRetry = jest.fn();
const checkSmsDailyLimit = jest.fn();

jest.mock("@/lib/whatsapp", () => ({
  isWhatsAppConfigured: () => Boolean(process.env.WHATSAPP_BUSINESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  sendWhatsAppTextMessage: (...a: unknown[]) => sendWhatsAppTextMessage(...a),
  sendWhatsAppTemplateMessage: (...a: unknown[]) => sendWhatsAppTemplateMessage(...a),
  formatWhatsAppPhone: (p: string) => p,
}));

jest.mock("@/lib/africas-talking", () => ({
  sendAfricasTalkingSMSWithRetry: (...a: unknown[]) => sendAfricasTalkingSMSWithRetry(...a),
  checkSmsDailyLimit: (...a: unknown[]) => checkSmsDailyLimit(...a),
}));

const ENV = process.env;

function load() {
  let mod!: typeof import("@/lib/messaging");
  jest.isolateModules(() => {
    mod = require("@/lib/messaging") as typeof import("@/lib/messaging");
  });
  return mod;
}

function setChannels(opts: { whatsapp: boolean; sms: boolean }) {
  if (opts.whatsapp) {
    process.env.WHATSAPP_BUSINESS_TOKEN = "tok";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "pid";
  } else {
    delete process.env.WHATSAPP_BUSINESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  }
  if (opts.sms) process.env.AFRICAS_TALKING_API_KEY = "smskey";
  else delete process.env.AFRICAS_TALKING_API_KEY;
}

beforeEach(() => {
  process.env = { ...ENV };
  sendWhatsAppTextMessage.mockReset().mockResolvedValue({ success: true, messageId: "wa-1" });
  sendWhatsAppTemplateMessage.mockReset().mockResolvedValue({ success: true, messageId: "wa-tpl-1" });
  sendAfricasTalkingSMSWithRetry.mockReset().mockResolvedValue({ success: true, messageId: "sms-1" });
  checkSmsDailyLimit.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  process.env = ENV;
});

describe("resolveChannel", () => {
  it("prefers WhatsApp when both channels are available", () => {
    setChannels({ whatsapp: true, sms: true });
    expect(load().resolveChannel(null)).toBe("whatsapp");
  });

  it("falls back to SMS when WhatsApp is not configured", () => {
    setChannels({ whatsapp: false, sms: true });
    expect(load().resolveChannel(null)).toBe("sms");
  });

  it("honours a school pinned to SMS even when WhatsApp exists", () => {
    setChannels({ whatsapp: true, sms: true });
    expect(load().resolveChannel("sms")).toBe("sms");
  });

  it("falls back when a school's pinned channel is unavailable", () => {
    setChannels({ whatsapp: true, sms: true });
    // School is pinned to SMS but SMS is down — must not silently do nothing.
    expect(load().resolveChannel("sms")).toBe("sms");
    setChannels({ whatsapp: false, sms: false });
    expect(load().resolveChannel("sms")).toBe("sms");
  });
});

describe("sendSchoolMessage", () => {
  it("sends over WhatsApp by default and does not touch SMS", async () => {
    setChannels({ whatsapp: true, sms: true });
    const { sendSchoolMessage } = load();
    const res = await sendSchoolMessage("0771234567", "Fees overdue", { kind: "fee_reminder" });
    expect(res.success).toBe(true);
    expect(res.channel).toBe("whatsapp");
    expect(sendWhatsAppTextMessage).toHaveBeenCalledTimes(1);
    expect(sendAfricasTalkingSMSWithRetry).not.toHaveBeenCalled();
  });

  it("uses an approved template for business-initiated sends when one is configured", async () => {
    setChannels({ whatsapp: true, sms: true });
    const { sendSchoolMessage } = load();
    const readSetting = jest.fn(async (key: string) =>
      key === "whatsapp_template_fee_reminder" ? "fee_reminder_v1" : null,
    );
    const res = await sendSchoolMessage("0771234567", "Fees overdue", {
      kind: "fee_reminder",
      readSetting,
    });
    expect(res.success).toBe(true);
    expect(sendWhatsAppTemplateMessage).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMessage.mock.calls[0][1]).toMatchObject({ templateName: "fee_reminder_v1" });
    expect(sendWhatsAppTextMessage).not.toHaveBeenCalled();
  });

  it("reports an honest failure when nothing is configured (never a false success)", async () => {
    setChannels({ whatsapp: false, sms: false });
    const { sendSchoolMessage } = load();
    const res = await sendSchoolMessage("0771234567", "Fees overdue", {});
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
    expect(sendWhatsAppTextMessage).not.toHaveBeenCalled();
    expect(sendAfricasTalkingSMSWithRetry).not.toHaveBeenCalled();
  });

  it("flags needsTemplate when WhatsApp rejects a proactive free-text send", async () => {
    setChannels({ whatsapp: true, sms: true });
    sendWhatsAppTextMessage.mockResolvedValue({
      success: false,
      error: "Message failed to send because more than 24 hours have passed",
    });
    const { sendSchoolMessage } = load();
    const res = await sendSchoolMessage("0771234567", "Fees overdue", { kind: "fee_reminder" });
    expect(res.success).toBe(false);
    expect(res.needsTemplate).toBe(true);
  });

  it("enforces the daily limit only on the SMS channel", async () => {
    setChannels({ whatsapp: true, sms: true });
    const { sendSchoolMessage } = load();

    await sendSchoolMessage("0771234567", "hi", { schoolId: "s1", kind: "absentee_alert" });
    expect(checkSmsDailyLimit).not.toHaveBeenCalled();

    await sendSchoolMessage("0771234567", "hi", {
      schoolId: "s1",
      kind: "absentee_alert",
      preferredChannel: "sms",
    });
    expect(checkSmsDailyLimit).toHaveBeenCalledWith("s1", 1);
  });

  it("refuses SMS when the school hit its daily limit", async () => {
    setChannels({ whatsapp: true, sms: true });
    checkSmsDailyLimit.mockResolvedValue(false);
    const { sendSchoolMessage } = load();
    const res = await sendSchoolMessage("0771234567", "hi", {
      schoolId: "s1",
      kind: "fee_reminder",
      preferredChannel: "sms",
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/limit/i);
    expect(sendAfricasTalkingSMSWithRetry).not.toHaveBeenCalled();
  });
});
