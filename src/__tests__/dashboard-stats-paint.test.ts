import { renderHook } from "@testing-library/react";
import { useDashboardStats } from "@/lib/hooks/analytics";
import { setCachedData, clearAllCache } from "@/lib/hooks/queryCache";

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
