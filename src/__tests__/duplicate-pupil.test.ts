/**
 * Admission should notice a pupil who is already on the roll.
 *
 * A school system protects against the same *student number* twice -- there is a
 * unique constraint on it. It does not protect against the same child being
 * added again under a fresh auto-generated number, which splits fees,
 * attendance and report cards across two records that look like two children.
 *
 * The match is name plus date of birth, and it warns rather than blocks. A name
 * on its own is far too weak in Ugandan schools, where two pupils in one class
 * can legitimately share it; blocking on name would train staff to ignore the
 * prompt, which is worse than having none.
 */

import { findDuplicateCandidates, type DuplicateCandidate } from "@/components/students/StudentDetailPanel";

const ROLL: DuplicateCandidate[] = [
  { id: "1", student_number: "SM/2026/0125", first_name: "Mbabaali", last_name: "Rahuma", date_of_birth: "2015-04-02" },
  {
    id: "2",
    student_number: "SM/2026/0181",
    first_name: "Namatovu",
    last_name: "Rahumah",
    date_of_birth: "2016-01-09",
  },
  { id: "3", student_number: "SM/2026/0003", first_name: "Peter", last_name: "Okello", date_of_birth: null },
  { id: "4", student_number: "SM/2026/0007", first_name: "peter", last_name: "OKELLO", date_of_birth: null },
];

const draft = (first_name: string, last_name: string, date_of_birth = "") => ({ first_name, last_name, date_of_birth });

describe("findDuplicateCandidates", () => {
  it("finds the pupil already on the roll", () => {
    const found = findDuplicateCandidates(ROLL, draft("Mbabaali", "Rahuma", "2015-04-02"));
    expect(found.map((c) => c.student_number)).toEqual(["SM/2026/0125"]);
  });

  it("ignores case and stray spaces, because typing is not typing", () => {
    const found = findDuplicateCandidates(ROLL, draft("  mbabaali ", " RAHUMA  ", "2015-04-02"));
    expect(found).toHaveLength(1);
  });

  it("treats two pupils sharing a name as a match when no date is known", () => {
    // P.3 can legitimately hold two Peter Okellos, so this warns rather than
    // refuses, but the bursar still gets to see it.
    const found = findDuplicateCandidates(ROLL, draft("Peter", "Okello"));
    expect(found.map((c) => c.id).sort()).toEqual(["3", "4"]);
  });

  it("separates two pupils who share a name but not a birthday", () => {
    const found = findDuplicateCandidates(ROLL, draft("Peter", "Okello", "2014-05-05"));
    // Only the pupil with no recorded date of birth can be compared; the other
    // is told apart by the date they do have.
    expect(found.map((c) => c.id)).toEqual(["3", "4"]);
  });

  it("does not match a different birthday", () => {
    expect(findDuplicateCandidates(ROLL, draft("Mbabaali", "Rahuma", "2018-12-25"))).toEqual([]);
  });

  it("matches on the first name alone being wrong, i.e. does not", () => {
    expect(findDuplicateCandidates(ROLL, draft("Brian", "Rahuma", "2015-04-02"))).toEqual([]);
  });

  it("does not match on a shared surname", () => {
    expect(findDuplicateCandidates(ROLL, draft("Namatovu", "Rahuma", "2016-01-09"))).toEqual([]);
  });

  it("needs both names before it says anything", () => {
    expect(findDuplicateCandidates(ROLL, draft("", "Rahuma"))).toEqual([]);
    expect(findDuplicateCandidates(ROLL, draft("Mbabaali", ""))).toEqual([]);
    expect(findDuplicateCandidates(ROLL, draft("  ", "   "))).toEqual([]);
  });

  it("leaves the pupil being edited out of their own match", () => {
    const found = findDuplicateCandidates(ROLL, draft("Peter", "Okello"), "3");
    expect(found.map((c) => c.id)).toEqual(["4"]);
  });

  it("does nothing when the caller has no roster, rather than throwing", () => {
    expect(findDuplicateCandidates(undefined, draft("Peter", "Okello"))).toEqual([]);
  });
});
