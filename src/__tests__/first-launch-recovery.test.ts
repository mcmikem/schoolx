/**
 * First-launch reliability.
 *
 * These guard the two things that made a crash on a phone that had never
 * opened the app impossible to diagnose: missing ES2020+ built-ins that the old
 * Android WebView never shipped, and an error screen that hid the message.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_COMPAT_SCRIPT } from "@/lib/legacy-compat";
import { sanitizeClientErrorPayload } from "@/lib/client-error-payload";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function notice_cleanup() {
  document.getElementById("unsupported-browser")?.remove();
  document.documentElement.removeAttribute("data-unsupported-browser");
}

describe("legacy compat polyfills", () => {
  it("is ES5-parseable so an old WebView can execute it at all", () => {
    expect(LEGACY_COMPAT_SCRIPT).not.toMatch(/=>/);
    expect(LEGACY_COMPAT_SCRIPT).not.toContain("`");
    expect(LEGACY_COMPAT_SCRIPT).not.toMatch(/\b(const|let)\s/);
    expect(() => new Function(LEGACY_COMPAT_SCRIPT)).not.toThrow();
  });

  it("restores the built-ins Next.js and the app bundle assume", () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const arrayProto = Array.prototype as unknown as Record<string, unknown>;
    const stringProto = String.prototype as unknown as Record<string, unknown>;
    const saved = {
      at: arrayProto.at,
      sat: stringProto.at,
      replaceAll: stringProto.replaceAll,
      hasOwn: (Object as unknown as Record<string, unknown>).hasOwn,
      timeout: (AbortSignal as unknown as Record<string, unknown>).timeout,
    };

    try {
      arrayProto.at = undefined;
      stringProto.at = undefined;
      stringProto.replaceAll = undefined;
      (Object as unknown as Record<string, unknown>).hasOwn = undefined;
      (AbortSignal as unknown as Record<string, unknown>).timeout = undefined;

      new Function(LEGACY_COMPAT_SCRIPT)();

      expect([1, 2, 3].at(-1)).toBe(3);
      expect("abc".at(-1)).toBe("c");
      expect("a_b_c".replaceAll("_", " ")).toBe("a b c");
      expect(Object.hasOwn({ a: 1 }, "a")).toBe(true);
      expect(typeof AbortSignal.timeout).toBe("function");
      expect(typeof (globalThis.crypto as Crypto).randomUUID).toBe("function");
    } finally {
      arrayProto.at = saved.at;
      stringProto.at = saved.sat;
      stringProto.replaceAll = saved.replaceAll;
      (Object as unknown as Record<string, unknown>).hasOwn = saved.hasOwn;
      (AbortSignal as unknown as Record<string, unknown>).timeout = saved.timeout;
      void g;
    }
  });

  it("aborts an AbortSignal.timeout after the delay", () => {
    jest.useFakeTimers();
    try {
      const signal = AbortSignal.timeout(50);
      expect(signal.aborted).toBe(false);
      jest.advanceTimersByTime(60);
      expect(signal.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("parses as ES5 on a real engine", () => {
    expect(() => new Function(LEGACY_COMPAT_SCRIPT)()).not.toThrow();
  });

  it("tells an old Android WebView to update instead of showing a dead screen", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 9; SM-J400F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.99 Mobile Safari/537.36";
    Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
    try {
      new Function(LEGACY_COMPAT_SCRIPT)();
      const notice = document.getElementById("unsupported-browser");
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("Update your browser");
      expect(notice?.textContent).toContain("Android System WebView");
      expect(document.documentElement.getAttribute("data-unsupported-browser")).toBe("1");
    } finally {
      notice_cleanup();
    }
  });

  it("does not block a supported Android browser", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
    Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
    try {
      new Function(LEGACY_COMPAT_SCRIPT)();
      expect(document.getElementById("unsupported-browser")).toBeNull();
      expect(document.documentElement.getAttribute("data-unsupported-browser")).toBeNull();
    } finally {
      notice_cleanup();
    }
  });

  it("tells an iPhone on iOS 15 to update iOS first", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1";
    Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
    try {
      new Function(LEGACY_COMPAT_SCRIPT)();
      const notice = document.getElementById("unsupported-browser");
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("16.4");
    } finally {
      notice_cleanup();
    }
  });

  it("is injected before any app bundle in the root layout", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('id="legacy-compat"');
    expect(layout).toContain("LEGACY_COMPAT_SCRIPT");
    expect(layout.indexOf('id="legacy-compat"')).toBeLessThan(layout.indexOf('id="theme-init"'));
  });
});

describe("crash visibility", () => {
  it("shows the real message on every error screen", () => {
    for (const file of [
      "src/app/error.tsx",
      "src/app/global-error.tsx",
      "src/app/dashboard/error.tsx",
      "src/components/PageErrorBoundary.tsx",
    ]) {
      expect(read(file)).toContain("ErrorDetails");
    }
    const details = read("src/components/ErrorDetails.tsx");
    expect(details).toContain("error?.message");
    expect(details).toContain("/api/client-error/");
  });

  it("caps and sanitises the unauthenticated beacon body", () => {
    const payload = sanitizeClientErrorPayload({
      message: "x".repeat(5000),
      stack: "y".repeat(9000),
      url: "https://app.example/dashboard/?token=secret",
      ua: "UA",
      digest: "abc",
      source: "app-error",
    });
    expect(payload?.message.length).toBeLessThanOrEqual(501);
    expect(payload?.stack?.length).toBeLessThanOrEqual(4001);
    expect(payload?.url).toBe("/dashboard/?…");
    expect(payload?.url).not.toContain("secret");
    expect(sanitizeClientErrorPayload({ message: "   " })).toBeNull();
    expect(sanitizeClientErrorPayload(null)).toBeNull();
  });

  it("rate-limits the public beacon route", () => {
    expect(read("src/app/api/client-error/route.ts")).toContain("rateLimit(request, 30");
    expect(read("src/proxy.ts")).toContain('"/api/client-error"');
  });
});

describe("old-WebView crash sources", () => {
  it("does not call crypto.randomUUID during render on scan pages", () => {
    expect(read("src/app/dashboard/store/meal-scan/page.tsx")).not.toContain("crypto.randomUUID");
    expect(read("src/app/dashboard/staff-attendance/scan/page.tsx")).not.toContain("crypto.randomUUID");
  });

  it("degrades when IntersectionObserver is missing", () => {
    expect(read("src/hooks/useCounter.ts")).toContain('typeof IntersectionObserver === "undefined"');
  });
});
