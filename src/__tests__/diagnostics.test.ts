import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  canViewDiagnostics,
  formatClockSkew,
  getRecentApiErrors,
  parseDebugFlag,
  readStoredSession,
  recordApiError,
  resetApiErrors,
} from "@/lib/diagnostics";

describe("diagnostics helpers", () => {
  it("reads debug=1, debug=0 and no flag", () => {
    expect(parseDebugFlag("?debug=1")).toBe("on");
    expect(parseDebugFlag("?debug=true")).toBe("on");
    expect(parseDebugFlag("?debug=0")).toBe("off");
    expect(parseDebugFlag("?debug=false")).toBe("off");
    expect(parseDebugFlag("?foo=bar")).toBeNull();
    expect(parseDebugFlag("debug=on")).toBe("on");
  });

  it("only allows school-level administrators to open the panel", () => {
    expect(canViewDiagnostics("school_admin")).toBe(true);
    expect(canViewDiagnostics("headmaster")).toBe(true);
    expect(canViewDiagnostics(["teacher", "headmaster"])).toBe(true);
    expect(canViewDiagnostics("teacher")).toBe(false);
    expect(canViewDiagnostics("bursar")).toBe(false);
    expect(canViewDiagnostics([])).toBe(false);
    expect(canViewDiagnostics(null)).toBe(false);
  });

  it("describes clock skew in the direction a support agent needs", () => {
    expect(formatClockSkew(null)).toBe("unknown");
    expect(formatClockSkew(500)).toBe("in sync");
    expect(formatClockSkew(-30_000)).toBe("30 s ahead");
    expect(formatClockSkew(90_000)).toBe("2 min behind");
    expect(formatClockSkew(-3_600_000)).toBe("60 min ahead");
  });

  it("keeps only the most recent API errors, newest first", () => {
    resetApiErrors();
    for (let i = 0; i < 12; i += 1) {
      recordApiError({ at: i, method: "GET", url: `/api/${i}/`, status: i });
    }
    const errors = getRecentApiErrors();
    expect(errors).toHaveLength(8);
    expect(errors[0]?.status).toBe(11);
    expect(errors[7]?.status).toBe(4);
  });

  it("finds the stored Supabase session expiry without touching the auth client", () => {
    window.localStorage.setItem("sb-smoke-auth-token", JSON.stringify({ expires_at: 1_700_000_000 }));
    try {
      const session = readStoredSession();
      expect(session.found).toBe(true);
      expect(session.expiresAt).toBe(1_700_000_000);
      expect(session.storage).toBe("local");
    } finally {
      window.localStorage.removeItem("sb-smoke-auth-token");
    }
  });

  it("reports no session when storage is empty", () => {
    const session = readStoredSession();
    expect(session.found).toBe(false);
    expect(session.expiresAt).toBeNull();
  });
});
