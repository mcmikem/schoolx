import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The grades page reported the same fact four times and stated its context
 * three times, on a 48-row table where a teacher is trying to type marks.
 *
 * These are pinned as source. The page is far too large to render meaningfully
 * in a unit test, and each of these was a visible defect rather than a subtle
 * one, so the text is the contract.
 */

const ROOT = path.join(__dirname, "..", "..");
const src = fs.readFileSync(path.join(ROOT, "src/app/dashboard/grades/page.tsx"), "utf8");

/** Strips comments, so prose explaining a fix is never mistaken for the defect. */
function code(): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const live = code();

describe("the marks table has readable headers", () => {
  it("does not render a stray closing bracket in numeric headers", () => {
    // Shipped as `)100` on every numeric column, because a literal ")" was
    // rendered next to the maximum instead of a "/" prefix.
    expect(live).not.toMatch(/\{"\)"\}/);
    expect(live).not.toContain(")100");
  });

  it("states the out-of mark as a suffix", () => {
    expect(live).toContain("/{ASSESSMENT_MAX[type]}");
  });

  it("does not repeat one sentence under every column", () => {
    // Was seven copies of "Classwork average -- every test..." in the header row.
    const repeats = (live.match(/Classwork average/g) ?? []).length;
    expect(repeats).toBeLessThanOrEqual(1);
  });
});

describe("progress is reported once, not four times", () => {
  it("has a single progress bar", () => {
    expect(live.match(/role="progressbar"/g) ?? []).toHaveLength(1);
  });

  it("no longer repeats the counts in a second strip", () => {
    expect(live).not.toContain('aria-label="grades overview"');
  });

  it("does not dump the ungraded names beside the filter bar", () => {
    // "Still to grade: <four names> +44 more" repeated what the count already
    // said, and scrolled away from the table it referred to.
    expect(live).not.toMatch(/Still to grade/i);
  });

  it("keeps a graded total and a pending total", () => {
    expect(live).toContain("graded");
    expect(live).toContain("Next:");
  });
});

describe("one save action, in one reachable place", () => {
  it("renders Save Grades once", () => {
    // Two existed, calling different handlers -- handleSaveGrades in the header
    // and handleSaveDraft in the sticky bar -- so the outcome depended on which
    // button the teacher happened to press.
    // Anchored to the closing button tag so the prose "<strong>Save Grades</strong>"
    // in the first-run guidance is not counted as a button.
    const buttons = live.match(/Save Grades\s*<\/button>/g) ?? [];
    expect(buttons.length).toBe(1);
  });

  it("has no permanent status light that cannot change", () => {
    // "Sync Active" read identically whether or not anything had synced, and
    // passed its icon as children rather than the `icon` prop, so it rendered
    // the literal word "cloud_done".
    expect(live).not.toMatch(/>\s*Sync Active\s*</);
    expect(live).not.toMatch(/<MaterialIcon[^>]*>cloud_done</);
  });
});

describe("the page asks for the class before listing its subjects", () => {
  it("renders the class picker before the subject list", () => {
    const classPicker = live.indexOf('htmlFor="grade-target-class"');
    const subjectList = live.indexOf("subject-picker-heading");
    expect(classPicker).toBeGreaterThan(-1);
    expect(subjectList).toBeGreaterThan(-1);
    // The subject list is derived from the class, so reading subjects first asks
    // the teacher to judge a list that is about to change underneath them.
    expect(classPicker).toBeLessThan(subjectList);
  });

  it("explains the assessment types once, behind a disclosure", () => {
    expect(live).toContain("What do BOT, MOT and EOT mean?");
  });

  it("gives first-run guidance without repeating itself", () => {
    // Was five steps, two of which said "leave a box empty".
    const guidance = live.slice(live.indexOf("How to enter marks"));
    const emptyBoxAdvice = (guidance.slice(0, 1200).match(/empty/gi) ?? []).length;
    expect(emptyBoxAdvice).toBeLessThanOrEqual(1);
  });
});

describe("a phone sees the class, not one pupil at a time", () => {
  it("defaults to the full list on every screen size", () => {
    // Phones used to open in the one-pupil swipe deck, so a teacher arriving to
    // mark a class of forty-eight was shown one child and had to swipe through
    // all of them. One-at-a-time is a good way to mark and a bad way to arrive.
    expect(live).not.toMatch(
      /window\.innerWidth\s*>=\s*768\)\s*setInlineEntryMode\(true\);\s*\n\s*else\s+setInlineEntryMode\(false\)/,
    );
    // The branch that used to do this is gone entirely, and the list default
    // is set unconditionally in the mount effect.
    expect(live).not.toContain("window.innerWidth >= 768");
    expect(live).toContain("setInlineEntryMode(true);");
  });

  it("keeps both layouts reachable", () => {
    expect(live).toContain("hidden md:block");
    expect(live).toContain("md:hidden");
  });

  it("names the modes for what they do", () => {
    // They were labelled for the layout each button hides.
    expect(live).toContain("All pupils");
    expect(live).toContain("One at a time");
    expect(live).not.toContain("Table View");
    expect(live).not.toContain("Mobile View");
  });

  it("tells you which pupil you are on in the deck", () => {
    // Without a position, a deck of forty-eight reads as finished after four.
    expect(live).toContain("Pupil {mobileStudentIndex + 1} of {filteredStudents.length}");
    expect(live).toContain("See all");
  });
});
