import { beforeEach, describe, expect, it } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import type { User } from "@/types";

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/useSyncStatus", () => ({
  useSyncStatus: jest.fn(),
}));

jest.mock("@/lib/diagnostics", () => ({
  ...jest.requireActual("@/lib/diagnostics"),
  fetchServerTime: jest.fn(),
  getServiceWorkerSnapshot: jest.fn(),
  getStorageSnapshot: jest.fn(),
  getEnvironmentSnapshot: jest.fn(),
  readStoredSession: jest.fn(),
  getRecentApiErrors: jest.fn(),
  installApiErrorRecorder: jest.fn(),
}));

import DiagnosticsPanel from "@/components/DiagnosticsPanel";
import { useAuth } from "@/lib/auth-context";
import * as diagnostics from "@/lib/diagnostics";
import { useSyncStatus } from "@/lib/useSyncStatus";

const mockUseAuth = jest.mocked(useAuth);
const mockUseSyncStatus = jest.mocked(useSyncStatus);
const mockFetchServerTime = jest.mocked(diagnostics.fetchServerTime);
const mockGetServiceWorkerSnapshot = jest.mocked(diagnostics.getServiceWorkerSnapshot);
const mockGetStorageSnapshot = jest.mocked(diagnostics.getStorageSnapshot);
const mockGetEnvironmentSnapshot = jest.mocked(diagnostics.getEnvironmentSnapshot);
const mockReadStoredSession = jest.mocked(diagnostics.readStoredSession);
const mockGetRecentApiErrors = jest.mocked(diagnostics.getRecentApiErrors);
const mockInstallApiErrorRecorder = jest.mocked(diagnostics.installApiErrorRecorder);

function makeUser(role: User["role"], roles?: User["role"][]): User {
  return {
    id: "user-1",
    auth_id: "auth-1",
    school_id: "school-1",
    full_name: "Test User",
    phone: "0777777777",
    role,
    roles,
    is_active: true,
    created_at: new Date().toISOString(),
  } as User;
}

function authValue(user: User | null): ReturnType<typeof useAuth> {
  return {
    user,
    school: null,
    loading: false,
    authInitialized: true,
    isDemo: false,
    isTrialExpired: false,
    profileDegraded: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSchool: jest.fn(),
    refreshSchoolFromAPI: jest.fn(),
    isSubscriptionActive: true,
    getSubscriptionPlan: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>;
}

function syncValue(): ReturnType<typeof useSyncStatus> {
  return {
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSynced: null,
    lastSyncedPerTable: {},
    isFromCache: false,
    syncErrors: [],
    syncNow: jest.fn(),
    checkPending: jest.fn(),
    refreshAll: jest.fn(),
    setIsFromCache: jest.fn(),
  } as unknown as ReturnType<typeof useSyncStatus>;
}

describe("DiagnosticsPanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/dashboard/");
    mockUseSyncStatus.mockReturnValue(syncValue());
    mockGetServiceWorkerSnapshot.mockResolvedValue({
      activeVersion: "skoolmate-abc123",
      controlled: true,
      registrations: 1,
      caches: ["skoolmate-abc123-static"],
    });
    mockGetStorageSnapshot.mockResolvedValue({ usageMb: 12, quotaMb: 500 });
    mockGetEnvironmentSnapshot.mockReturnValue({
      userAgent: "test",
      platform: "test",
      language: "en",
      timezone: "Africa/Kampala",
      displayMode: "browser",
      online: true,
      viewport: "390x844",
      pixelRatio: 3,
      connection: { effectiveType: "3g", downlinkMbps: 1.2, rttMs: 300, saveData: false },
      deviceMemoryGb: 2,
      hardwareConcurrency: 4,
    });
    mockReadStoredSession.mockReturnValue({ found: true, expiresAt: null, storage: "local" });
    mockGetRecentApiErrors.mockReturnValue([]);
    mockInstallApiErrorRecorder.mockReturnValue(() => {});
    mockFetchServerTime.mockResolvedValue({
      serverTime: Date.now(),
      clientTime: Date.now(),
      skewMs: -3_600_000,
      latencyMs: 120,
    });
  });

  it("stays hidden without ?debug=1", async () => {
    mockUseAuth.mockReturnValue(authValue(makeUser("headmaster")) as ReturnType<typeof useAuth>);
    render(<DiagnosticsPanel />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Diagnostics")).toBeNull();
  });

  it("stays hidden for non-administrators even with ?debug=1", async () => {
    window.history.replaceState({}, "", "/dashboard/?debug=1");
    mockUseAuth.mockReturnValue(authValue(makeUser("teacher")) as ReturnType<typeof useAuth>);
    render(<DiagnosticsPanel />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Diagnostics")).toBeNull();
  });

  it("shows clock skew and the build to a headmaster", async () => {
    window.history.replaceState({}, "", "/dashboard/?debug=1");
    mockUseAuth.mockReturnValue(
      authValue(makeUser("headmaster", ["headmaster", "teacher"])) as ReturnType<typeof useAuth>,
    );
    render(<DiagnosticsPanel />);
    expect(await screen.findByText("Diagnostics")).toBeTruthy();
    expect(await screen.findByText("60 min ahead")).toBeTruthy();
    expect(await screen.findByText("skoolmate-abc123")).toBeTruthy();
    await waitFor(() => expect(mockGetServiceWorkerSnapshot).toHaveBeenCalled());
  });

  it("lets a school administrator open the panel after login", async () => {
    window.history.replaceState({}, "", "/dashboard/?debug=1");
    mockUseAuth.mockReturnValue(authValue(makeUser("school_admin")) as ReturnType<typeof useAuth>);
    render(<DiagnosticsPanel />);
    expect(await screen.findByText("Diagnostics")).toBeTruthy();
  });
});
