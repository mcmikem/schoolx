import {
  getOrFetchCached,
  getCachedData,
  setCachedData,
  invalidateCache,
  invalidateCachePattern,
  subscribeToCache,
  clearAllCache,
} from "@/lib/hooks/queryCache";

describe("queryCache", () => {
  beforeEach(() => {
    clearAllCache();
  });

  describe("getOrFetchCached", () => {
    it("collapses concurrent callers into a single fetch", async () => {
      let calls = 0;
      let release: (v: string[]) => void = () => {};
      const gate = new Promise<string[]>((resolve) => {
        release = resolve;
      });
      const fetcher = async () => {
        calls++;
        return gate;
      };

      const a = getOrFetchCached("students:1:100:0", fetcher);
      const b = getOrFetchCached("students:1:100:0", fetcher);
      const c = getOrFetchCached("students:1:100:0", fetcher);
      release(["one"]);

      const results = await Promise.all([a, b, c]);

      expect(calls).toBe(1);
      expect(results.map((r) => r.data)).toEqual([["one"], ["one"], ["one"]]);
      expect(results.every((r) => r.fromCache === false)).toBe(true);
    });

    it("serves a later call from cache without refetching", async () => {
      let calls = 0;
      const fetcher = async () => {
        calls++;
        return ["value"];
      };

      await getOrFetchCached("k1", fetcher);
      const second = await getOrFetchCached("k1", fetcher);

      expect(calls).toBe(1);
      expect(second.fromCache).toBe(true);
    });

    it("does not cache a failed fetch, so a later attempt can retry", async () => {
      let calls = 0;
      const fetcher = async () => {
        calls++;
        if (calls === 1) throw new Error("network down");
        return ["recovered"];
      };

      await expect(getOrFetchCached("k2", fetcher)).rejects.toThrow("network down");
      const retry = await getOrFetchCached("k2", fetcher);

      expect(calls).toBe(2);
      expect(retry.data).toEqual(["recovered"]);
    });

    it("keeps distinct keys independent", async () => {
      const a = await getOrFetchCached("page:0", async () => ["a"]);
      const b = await getOrFetchCached("page:1", async () => ["b"]);

      expect(a.data).toEqual(["a"]);
      expect(b.data).toEqual(["b"]);
    });
  });

  describe("invalidation", () => {
    it("invalidates every page of a list, not just an exact key", () => {
      setCachedData("students:s1:100:0", ["page0"]);
      setCachedData("students:s1:100:20", ["page1"]);
      setCachedData("students:s2:100:0", ["other school"]);

      invalidateCachePattern("students:s1:");

      expect(getCachedData("students:s1:100:0")).toBeNull();
      expect(getCachedData("students:s1:100:20")).toBeNull();
      expect(getCachedData("students:s2:100:0")).toEqual(["other school"]);
    });

    it("invalidates the full cached payload used by the students hook", () => {
      setCachedData("students:s1:100:0", { students: ["a"], count: 1 });

      invalidateCachePattern("students:s1:");

      expect(getCachedData("students:s1:100:0")).toBeNull();
    });

    it("notifies subscribers of an invalidated entry", () => {
      const seen: string[] = [];
      const key = "students:s1:100:0";
      const unsubscribe = subscribeToCache(key, () => seen.push(key));
      setCachedData(key, { students: [], count: 0 });

      invalidateCachePattern("students:s1:");

      expect(seen).toContain(key);
      unsubscribe();
    });

    it("leaves other keys alone when invalidating one exactly", () => {
      setCachedData("fee:s1", ["a"]);
      setCachedData("fee:s2", ["b"]);

      invalidateCache("fee:s1");

      expect(getCachedData("fee:s1")).toBeNull();
      expect(getCachedData("fee:s2")).toEqual(["b"]);
    });
  });
});

describe("dedupeRead", () => {
  it("collapses simultaneous identical reads without retaining the result", async () => {
    const { dedupeRead } = await import("@/lib/hooks/utils");
    let calls = 0;
    const run = async () => {
      calls++;
      return ["row"];
    };

    const [a, b] = await Promise.all([
      dedupeRead("attendance:school:day", run),
      dedupeRead("attendance:school:day", run),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual(["row"]);
    expect(b).toEqual(["row"]);

    // Nothing is cached: a later read fetches again, so callers never see
    // stale attendance.
    await dedupeRead("attendance:school:day", run);
    expect(calls).toBe(2);
  });

  it("releases the key after a failure so a retry can proceed", async () => {
    const { dedupeRead } = await import("@/lib/hooks/utils");
    let calls = 0;
    const run = async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return ["ok"];
    };

    await expect(dedupeRead("k", run)).rejects.toThrow("offline");
    await expect(dedupeRead("k", run)).resolves.toEqual(["ok"]);
    expect(calls).toBe(2);
  });

  it("keeps different keys independent", async () => {
    const { dedupeRead } = await import("@/lib/hooks/utils");
    const a = await dedupeRead("day-1", async () => ["one"]);
    const b = await dedupeRead("day-2", async () => ["two"]);

    expect(a).toEqual(["one"]);
    expect(b).toEqual(["two"]);
  });
});
