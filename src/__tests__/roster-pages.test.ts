import { collectRosterPages } from "../lib/hooks/students";

// collectRosterPages is the loop behind fetchAllStudents(). Every dashboard
// figure about "students at risk" / "who owes money" / the boy-girl split is
// computed over whatever this returns, so a truncation here is a wrong number
// on a headmaster's home screen with nothing to warn them.

interface Row {
  id: string;
}

function makeRows(from: number, to: number): Row[] {
  return Array.from({ length: to - from }, (_, i) => ({ id: `s${from + i}` }));
}

describe("collectRosterPages", () => {
  it("reads a school that fits in one page exactly once", async () => {
    const calls: Array<[number, number]> = [];
    const fetchPage = jest.fn(async (offset: number, limit: number) => {
      calls.push([offset, limit]);
      return { rows: makeRows(offset, offset + 5), total: 5 };
    });

    const { rows, total } = await collectRosterPages(fetchPage);

    expect(rows).toHaveLength(5);
    expect(total).toBe(5);
    expect(calls).toEqual([[0, 1000]]);
  });

  it("keeps paging until the reported total is reached", async () => {
    const offsets: number[] = [];
    const fetchPage = jest.fn(async (offset: number, limit: number) => {
      offsets.push(offset);
      const end = Math.min(offset + limit, 2500);
      return { rows: makeRows(offset, end), total: 2500 };
    });

    const { rows, total } = await collectRosterPages(fetchPage);

    expect(offsets).toEqual([0, 1000, 2000]);
    expect(rows).toHaveLength(2500);
    expect(total).toBe(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
  });

  it("advances by rows received when the server caps below pageSize", async () => {
    // PostgREST max-rows can sit under what we ask for. Reading the offset from
    // what we REQUESTED instead of what ARRIVED would skip whole bands of
    // students and report the school as smaller than it is.
    const offsets: number[] = [];
    const fetchPage = jest.fn(async (offset: number) => {
      offsets.push(offset);
      return { rows: makeRows(offset, offset + 200), total: 5000 };
    });

    const { rows } = await collectRosterPages(fetchPage, { pageSize: 1000 });

    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(200);
    expect(offsets.at(-1)).toBe(4800);
    expect(rows).toHaveLength(5000);
  });

  it("counts a row that straddles two pages once", async () => {
    // ids are UUIDs, so a student inserted while the scan runs can land on both
    // sides of a page boundary. Twice would mean two students where there is one.
    let call = 0;
    const fetchPage = jest.fn(async (offset: number, limit: number) => {
      call += 1;
      if (call === 1) return { rows: makeRows(0, 1000), total: 1200 };
      // The window slid: the last row of page one is repeated here.
      return { rows: [{ id: "s999" }, ...makeRows(1000, 1200)], total: 1200 };
    });

    const { rows } = await collectRosterPages(fetchPage);

    expect(rows).toHaveLength(1200);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1200);
  });

  it("stops when the total is unknown and a page comes back empty", async () => {
    const fetchPage = jest.fn(async (offset: number, limit: number) => ({
      rows: offset === 0 ? makeRows(0, 5) : [],
      total: null,
    }));

    const { rows, total } = await collectRosterPages(fetchPage);

    expect(rows).toHaveLength(5);
    expect(total).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("does not treat a short page as the end while the total disagrees", async () => {
    const offsets: number[] = [];
    const fetchPage = jest.fn(async (offset: number) => {
      offsets.push(offset);
      return { rows: makeRows(offset, offset + 10), total: 40 };
    });

    const { rows } = await collectRosterPages(fetchPage, { pageSize: 100 });

    expect(offsets).toEqual([0, 10, 20, 30]);
    expect(rows).toHaveLength(40);
  });

  it("respects the safety valve instead of scanning a runaway count", async () => {
    const fetchPage = jest.fn(async (offset: number, limit: number) => ({
      rows: makeRows(offset, offset + limit),
      total: 100000,
    }));

    const { rows, total } = await collectRosterPages(fetchPage, { pageSize: 100, maxRows: 300 });

    expect(rows).toHaveLength(300);
    expect(total).toBe(100000);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("returns an empty roster for a school with no students", async () => {
    const fetchPage = jest.fn(async () => ({ rows: [], total: 0 }));

    const { rows, total } = await collectRosterPages(fetchPage);

    expect(rows).toEqual([]);
    expect(total).toBe(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propagates a page failure instead of returning what it managed to read", async () => {
    let call = 0;
    const fetchPage = jest.fn(async (offset: number, limit: number) => {
      call += 1;
      if (call === 2) throw new Error("Timed out reading the student roster");
      return { rows: makeRows(offset, offset + limit), total: 3000 };
    });

    await expect(collectRosterPages(fetchPage)).rejects.toThrow("Timed out reading the student roster");
  });
});
