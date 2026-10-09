import { act, renderHook } from "@testing-library/react";
import { useDashboardStats } from "@/lib/hooks/analytics";
import { setCachedData, clearAllCache } from "@/lib/hooks/queryCache";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn(),
  },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isDemo: false }),
}));

jest.mock("@/lib/offline", () => ({
  // IndexedDB is intentionally empty here: the point is that the memory
  // cache paints before this async seed lands.
  offlineDB: {
    get: async () => null,
    cacheFromServer: async () => {},
  },
}));

jest.mock("@/lib/supabase", () => {
  const feeRow = {
    students_count: 10,
    expected_total: 1000,
    collected_total: 600,
    overdue_count: 1,
    high_risk_count: 0,
    this_month_total: 100,
    last_month_total: 50,
    overdue_balance: 400,
    defaulters: [],
  };
  const makeChain = (result: unknown): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
    return chain;
  };
  return {
    supabase: {
      rpc: jest.fn(() => ({
        maybeSingle: () => Promise.resolve({ data: feeRow, error: null }),
      })),
      from: jest.fn(() => makeChain({ count: 4, error: null })),
    },
  };
});

describe("useDashboardStats instant paint", () => {
  beforeEach(() => {
    clearAllCache();
  });

  it("paints memory-cached stats on the first render with loading already false", () => {
    setCachedData("dashboard-stats:school-1:all:all", {
      stats: {
        totalStudents: 24,
        maleStudents: 12,
        femaleStudents: 12,
        activeStudents: 24,
        presentToday: 20,
        feesCollected: 600,
        feesBalance: 400,
        totalClasses: 3,
        totalTeachers: 5,
      },
      savedAt: Date.now(),
    });

    const { result, unmount } = renderHook(() => useDashboardStats("school-1"));

    // No waiting for the IndexedDB seed: numbers are there immediately and no
    // skeleton flashes.
    expect(result.current.stats.totalStudents).toBe(24);
    expect(result.current.stats.feesCollected).toBe(600);
    expect(result.current.loading).toBe(false);
    unmount();
  });

  it("starts loading with empty stats when nothing is cached", () => {
    const { result, unmount } = renderHook(() => useDashboardStats("school-1"));

    expect(result.current.stats.totalStudents).toBe(0);
    expect(result.current.loading).toBe(true);
    unmount();
  });
});

describe("useDashboardStats timeout handling", () => {
  beforeEach(() => {
    clearAllCache();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("warns instead of erroring when fee_summary times out, then retries once", async () => {
    const rpc = supabase.rpc as unknown as jest.Mock;
    rpc.mockImplementationOnce(() => ({ maybeSingle: () => new Promise(() => {}) }));

    const { result, unmount } = renderHook(() => useDashboardStats("school-1"));
    await act(async () => {});
    expect(rpc).toHaveBeenCalledTimes(1);

    // fee_summary never resolves, so its 15s deadline fires first.
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    const warnCalls = (logger.warn as jest.Mock).mock.calls;
    const statsWarn = warnCalls.find((call) => String(call[0]).includes("useDashboardStats"));
    expect(statsWarn).toBeDefined();
    expect(String(statsWarn?.[0])).toContain("timed out");
    expect((statsWarn?.[1] as Error).message).toContain("fee_summary");
    expect(logger.error).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);

    // One retry after the backoff, which succeeds with the default mock.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    await act(async () => {});

    expect(result.current.stats.totalStudents).toBe(4);
    expect(result.current.stats.feesCollected).toBe(600);
    expect(logger.error).not.toHaveBeenCalled();
    unmount();
  });

  it("still reports real failures as errors", async () => {
    const rpc = supabase.rpc as unknown as jest.Mock;
    rpc.mockImplementationOnce(() => ({
      maybeSingle: () => Promise.resolve({ data: null, error: { message: "boom", code: "XX000" } }),
    }));

    const { unmount } = renderHook(() => useDashboardStats("school-1"));
    await act(async () => {});

    expect(logger.error).toHaveBeenCalledWith("Error fetching stats:", expect.anything());
    expect(logger.warn).not.toHaveBeenCalled();
    unmount();
  });
});
