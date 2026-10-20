import { act, renderHook } from "@testing-library/react";
import { useAutoSave } from "@/lib/hooks/useAutoSave";

describe("onboarding draft safety", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("does not write a disabled draft on unmount", () => {
    const { unmount } = renderHook(() => useAutoSave({ data: { step: 5 }, storageKey: "setup", enabled: false }));
    unmount();
    expect(localStorage.getItem("draft_setup")).toBeNull();
  });
  it("keeps setup drafts longer when configured without changing the default expiry", () => {
    localStorage.setItem("draft_setup", JSON.stringify({ data: { step: 2 }, savedAt: Date.now() - 2 * 86400000 }));
    const defaults = renderHook(() => useAutoSave({ data: {}, storageKey: "setup", enabled: false }));
    expect(defaults.result.current.loadFromStorage()).toBeNull();
    const setup = renderHook(() =>
      useAutoSave({ data: {}, storageKey: "setup", enabled: false, maxAgeMs: 30 * 86400000 }),
    );
    expect(setup.result.current.loadFromStorage()).toEqual({ step: 2 });
  });
  it("reports blocked storage instead of throwing during autosave", () => {
    const previousWrite = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("Full");
    });
    try {
      const { result, unmount } = renderHook(() =>
        useAutoSave({ data: { step: 1 }, storageKey: "setup", interval: 100 }),
      );
      expect(() => act(() => jest.advanceTimersByTime(100))).not.toThrow();
      expect(result.current.storageAvailable).toBe(false);
      expect(() => unmount()).not.toThrow();
    } finally {
      localStorage.setItem = previousWrite;
    }
  });
  it("clearing a disabled final-step draft does not recreate it", () => {
    localStorage.setItem("draft_setup", JSON.stringify({ data: { step: 4 }, savedAt: Date.now() }));
    const { result, unmount } = renderHook(() =>
      useAutoSave({ data: { step: 5 }, storageKey: "setup", enabled: false }),
    );
    act(() => result.current.clearDraft());
    unmount();
    expect(localStorage.getItem("draft_setup")).toBeNull();
  });
});
