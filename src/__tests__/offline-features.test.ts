import { getOnlineOnlyFeature, isOnlineOnlyPath, onlineOnlySummary } from "@/lib/offline-features";

describe("online-only feature labels", () => {
  it("labels payment and SMS routes, including their children", () => {
    expect(getOnlineOnlyFeature("/dashboard/billing")?.label).toBe("Billing and payments");
    expect(getOnlineOnlyFeature("/dashboard/billing/")?.label).toBe("Billing and payments");
    expect(getOnlineOnlyFeature("/dashboard/bulk-sms/history")?.label).toBe("Bulk SMS");
    expect(isOnlineOnlyPath("/dashboard/sms-delivery")).toBe(true);
  });

  it("does not label ordinary offline-capable work", () => {
    expect(getOnlineOnlyFeature("/dashboard/attendance/")).toBeNull();
    expect(getOnlineOnlyFeature("/dashboard/grades/")).toBeNull();
    expect(getOnlineOnlyFeature("/dashboard/students/")).toBeNull();
    expect(getOnlineOnlyFeature("/dashboard/fees/")).toBeNull();
  });

  it("gives the offline banner a sentence that names the feature and reason", () => {
    expect(onlineOnlySummary("/dashboard/bulk-sms/")).toMatch(/Bulk SMS needs internet/);
    expect(onlineOnlySummary("/dashboard/attendance/")).toBeNull();
  });
});
