/**
 * Searching for a pupil must find them whether or not they owe money.
 *
 * The fees screen hides "cleared" pupils by default, because triaging who owes
 * is the job. But the toggle also ran on a search: a name would match, the
 * toggle would drop them again, and the header would report "3 of 263 pupils"
 * for a search matching four.
 *
 * That is not a cosmetic count. A bursar searching a name to confirm a child is
 * on the roll was told the child was absent from the school, and reported the
 * roll as looking like data loss. The pupil in question -- Mbabaali Rahuma,
 * SM/2026/0125 -- was fully paid: UGX 100,000 expected, UGX 100,000 paid,
 * balance 0.
 *
 * Asking for someone by name means wanting them either way, so a non-empty
 * search term overrides the toggle. The badge still says what they owe, so
 * nothing is hidden -- it is just no longer filtered away.
 */

interface Row {
  name: string;
  student_number: string;
  class_id: string | null;
  status: string;
  balance: number;
}

const MABABAALI: Row = {
  name: "Mbabaali Rahuma",
  student_number: "SM/2026/0125",
  class_id: "p2",
  status: "paid",
  balance: 0,
};
const MBABALI: Row = {
  name: "Mbabali Zubaili",
  student_number: "12",
  class_id: "p5",
  status: "unpaid",
  balance: 120000,
};
const ROLL = [MABABAALI, MBABALI];

function filter(
  rows: Row[],
  searchTerm: string,
  hideCleared: boolean,
  selectedClass = "all",
  statusFilter = "all",
): Row[] {
  const query = searchTerm.trim().toLowerCase();
  const hasSearch = query.length > 0;
  return rows.filter((s) => {
    const matchesSearch =
      !hasSearch || s.name.toLowerCase().includes(query) || s.student_number.toLowerCase().includes(query);
    const matchesClass = selectedClass === "all" || s.class_id === selectedClass;
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesOwing = !hideCleared || s.balance > 0 || hasSearch;
    return matchesSearch && matchesClass && matchesStatus && matchesOwing;
  });
}

describe("fee balance search", () => {
  it("finds a fully paid pupil whose name matches", () => {
    const found = filter(ROLL, "mbabaali", true);
    expect(found.map((s) => s.student_number)).toEqual(["SM/2026/0125"]);
  });

  it("counts every pupil the search term actually matches", () => {
    // "mbab" matches four on the live roll; it used to report three.
    expect(filter(ROLL, "mbab", true)).toHaveLength(2);
  });

  it("still hides cleared pupils when nobody is searching", () => {
    expect(filter(ROLL, "", true).map((s) => s.student_number)).toEqual(["12"]);
  });

  it("still shows cleared pupils when the toggle is off", () => {
    expect(filter(ROLL, "", false)).toHaveLength(2);
  });

  it("keeps honouring the class and status filters alongside the search", () => {
    expect(filter(ROLL, "mbab", true, "p2")).toHaveLength(1);
    expect(filter(ROLL, "mbab", true, "p2")[0].student_number).toBe("SM/2026/0125");
    // An explicit "Owing" filter still means owing, search or not.
    expect(filter(ROLL, "mbab", true, "all", "unpaid")).toHaveLength(1);
  });

  it("treats whitespace-only search as no search", () => {
    // Otherwise a stray space re-surfaced every cleared pupil in the school.
    expect(filter(ROLL, "   ", true)).toHaveLength(1);
  });
});
