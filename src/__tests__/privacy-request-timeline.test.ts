import { getPrivacyRequestResponseTarget, isPrivacyRequestClosed } from "@/lib/privacy-request-timeline";

describe("privacy request response targets", () => {
  it.each(["access", "correction", "deletion"])("sets a seven-day target for %s", (type) => {
    expect(getPrivacyRequestResponseTarget(type, "2026-11-09T10:00:00.000Z")).toEqual({
      days: 7,
      dueAt: new Date("2026-11-16T10:00:00.000Z"),
    });
  });

  it("sets the fourteen-day target for an objection", () => {
    expect(getPrivacyRequestResponseTarget("objection", "2026-11-09T10:00:00.000Z")).toEqual({
      days: 14,
      dueAt: new Date("2026-11-23T10:00:00.000Z"),
    });
  });

  it("does not invent a deadline for other requests and recognises closed cases", () => {
    expect(getPrivacyRequestResponseTarget("other", "2026-11-09T10:00:00.000Z")).toBeNull();
    expect(getPrivacyRequestResponseTarget("access", "invalid")).toBeNull();
    expect(isPrivacyRequestClosed("completed")).toBe(true);
    expect(isPrivacyRequestClosed("in_review")).toBe(false);
  });
});
