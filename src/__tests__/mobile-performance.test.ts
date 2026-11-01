import { shouldUseLite } from "@/lib/performance-mode";
import { readDraft, writeDraft, clearDraft } from "@/lib/draft-storage";
import { runBackgroundWork } from "@/lib/background-work";

describe("mobile performance and interruption recovery", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("protects a low-memory phone even on fast Wi-Fi, and allows an explicit choice", () => {
    const phone = { deviceMemory: 2, hardwareConcurrency: 8, connection: { effectiveType: "4g" } };
    expect(shouldUseLite(phone)).toBe(true);
    expect(shouldUseLite(phone, "full")).toBe(false);
    expect(shouldUseLite({ deviceMemory: 16 }, "lite")).toBe(true);
    expect(shouldUseLite({ connection: { effectiveType: "3g" } })).toBe(true);
    expect(shouldUseLite({ reducedData: true })).toBe(true);
  });
  it("recovers drafts within their account and task scope and expires old work", () => {
    const first = "draft:teacher-a:class-a:2026-11-01";
    expect(writeDraft(first, { student: "absent" })).toBe(true);
    expect(readDraft(first)).toEqual({ student: "absent" });
    expect(readDraft("draft:teacher-b:class-a:2026-11-01")).toBeNull();
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 8 * 86400000);
    expect(readDraft(first)).toBeNull();
    jest.restoreAllMocks();
    clearDraft(first);
    expect(readDraft(first)).toBeNull();
  });
  it("reports storage failure so the UI cannot promise recovery", () => {
    jest.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("Quota exceeded");
    });
    expect(writeDraft("full", { mark: 50 })).toBe(false);
    jest.restoreAllMocks();
  });
  it("serializes competing background downloads and continues after a failure", async () => {
    const order: string[] = [];
    let release!: () => void;
    const first = runBackgroundWork(async () => {
      order.push("first");
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const second = runBackgroundWork(async () => {
      order.push("second");
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["first"]);
    release();
    await first;
    await second;
    expect(order).toEqual(["first", "second"]);
    await expect(
      runBackgroundWork(async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");
    await expect(runBackgroundWork(async () => 42)).resolves.toBe(42);
  });
  it("does not start cancelled background work", async () => {
    const controller = new AbortController();
    controller.abort();
    const work = jest.fn();
    await expect(runBackgroundWork(work, controller.signal)).rejects.toThrow("cancelled");
    expect(work).not.toHaveBeenCalled();
  });
});
