import { offlineDB } from "@/lib/offline";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/background-work", () => ({
  runBackgroundWork: async (work: () => Promise<unknown>, signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error("Cancelled");
    return work();
  },
}));
jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

describe("verified offline data preparation", () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    gte: jest.fn(),
    gt: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    abortSignal: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of ["select", "eq", "in", "gte", "gt", "order", "range"] as const) query[key].mockReturnValue(query);
    (supabase.from as jest.Mock).mockReturnValue(query);
    jest.spyOn(offlineDB, "cacheFromServer").mockResolvedValue(undefined);
    jest.spyOn(offlineDB, "pruneCachedTableToClassSelection").mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it("labels a capped history download as partial and uses a stable cursor", async () => {
    query.abortSignal
      .mockResolvedValueOnce({ data: [{ id: "a" }, { id: "b" }], count: 5, error: null })
      .mockResolvedValueOnce({ data: [{ id: "c" }, { id: "d" }], count: 3, error: null });
    const progress = jest.fn();
    const result = await offlineDB.warmTables(["grades"], {
      pageSize: 2,
      maxRows: 4,
      schoolId: "school-a",
      academicYear: "2026",
      term: 3,
      onProgress: progress,
    });
    expect(result.rows).toBe(4);
    expect(query.eq).toHaveBeenCalledWith("school_id", "school-a");
    expect(query.eq).toHaveBeenCalledWith("academic_year", "2026");
    expect(query.eq).toHaveBeenCalledWith("term", 3);
    expect(query.gt).toHaveBeenCalledWith("id", "b");
    expect(progress).toHaveBeenLastCalledWith("grades", 4, 5, false);
    expect(result.tables).toBe(0);
    expect(result.errors[0]).toContain("downloaded 4 of 5 records");
  });
  it("does not claim a capped table is complete when the server omits its total", async () => {
    query.abortSignal.mockResolvedValueOnce({
      data: [{ id: "a" }, { id: "b" }],
      count: null,
      error: null,
    });
    const progress = jest.fn();
    const result = await offlineDB.warmTables(["grades"], {
      pageSize: 2,
      maxRows: 2,
      schoolId: "school-a",
      onProgress: progress,
    });
    expect(result.tables).toBe(0);
    expect(result.errors[0]).toContain("downloaded 2 of an unknown number of records");
    expect(progress).toHaveBeenLastCalledWith("grades", 2, null, false);
  });
  it("finishes the roster even when history has a smaller budget", async () => {
    query.abortSignal
      .mockResolvedValueOnce({ data: [{ id: "a" }, { id: "b" }], count: 3, error: null })
      .mockResolvedValueOnce({ data: [{ id: "c" }], count: 1, error: null });
    const progress = jest.fn();
    await offlineDB.warmTables(["students"], { pageSize: 2, maxRows: 2, schoolId: "school-a", onProgress: progress });
    expect(progress).toHaveBeenLastCalledWith("students", 3, 3, true);
    expect(offlineDB.cacheFromServer).toHaveBeenCalledTimes(2);
  });
  it("limits a selected-class preparation to its roster and student-linked marks", async () => {
    query.abortSignal
      .mockResolvedValueOnce({ data: [{ id: "learner-a" }, { id: "learner-b" }], count: 2, error: null })
      .mockResolvedValueOnce({ data: [{ id: "learner-a" }], count: 1, error: null });
    const result = await offlineDB.warmTables(["students", "grades"], {
      schoolId: "school-a",
      classIds: ["class-a"],
    });
    expect(result.errors).toEqual([]);
    expect(query.in).toHaveBeenCalledWith("class_id", ["class-a"]);
    expect(query.in).toHaveBeenCalledWith("student_id", ["learner-a", "learner-b"]);
    expect(query.eq).toHaveBeenCalledWith("school_id", "school-a");
    expect(offlineDB.pruneCachedTableToClassSelection).toHaveBeenCalledWith(
      "grades",
      "school-a",
      ["class-a"],
      ["learner-a", "learner-b"],
    );
  });
  it("does not report failed downloads as complete", async () => {
    query.abortSignal.mockResolvedValueOnce({ data: null, count: null, error: { message: "Network failed" } });
    const progress = jest.fn();
    const result = await offlineDB.warmTables(["grades"], { onProgress: progress });
    expect(result.tables).toBe(0);
    expect(result.errors).toEqual(["grades: Network failed"]);
    expect(progress).not.toHaveBeenCalled();
  });
  it("does not cache data after the account's preparation has been cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await offlineDB.warmTables(["students"], { signal: controller.signal });
    expect(result.rows).toBe(0);
    expect(offlineDB.cacheFromServer).not.toHaveBeenCalled();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
