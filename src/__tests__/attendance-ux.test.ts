import * as fs from "node:fs";
import * as path from "node:path";

// The attendance register speaks plain Present/Absent — never the "In
// School"/"Away" euphemisms — and a save lands on a summary, not the same
// list. Both are one careless edit away from regressing, and neither is
// covered by logic tests (the page needs heavy mocks to render), so the
// source is pinned here as text, the same way pwa-update.test.ts does it.

const ROOT = path.join(__dirname, "..", "..");
const page = fs.readFileSync(path.join(ROOT, "src/app/dashboard/attendance/page.tsx"), "utf8");

describe("attendance vocabulary", () => {
  it("labels statuses Present/Absent, never In School/Away", () => {
    expect(page).toContain('label: "Present"');
    expect(page).toContain('label: "Absent"');
    expect(page).not.toContain("In School");
    expect(page).not.toContain("Not In School");
    expect(page).not.toContain("Quick Away");
    expect(page).not.toContain("Mark All In School");
  });

  it("sends DB status values unchanged (labels only, no data migration)", () => {
    // The canonical cycle still drives storage; only STATUS_CONFIG labels changed.
    expect(page).toContain('["present", "absent", "late", "excused"]');
  });
});

describe("attendance post-save done state", () => {
  it("replaces the register with a summary after save", () => {
    expect(page).toContain("savedSummary");
    expect(page).toContain("Attendance saved");
    expect(page).toContain("Mark another class");
    expect(page).toContain("Back to register");
    expect(page).toContain("View report");
  });

  it("leads marking rows with photos, not admission numbers", () => {
    expect(page).toContain("RollCallPhoto");
    expect(page).toContain("photo_url");
  });
});

describe("attendance mark-and-advance", () => {
  it("tucks marked rows away so the next unmarked pupil slides up", () => {
    expect(page).toContain("collapsedIds");
    expect(page).toContain("visibleStudents");
    // Review views (active filter/search) always show everything matching.
    expect(page).toContain("isReviewing");
  });

  it("flashes an unmissable confirmation on every mark", () => {
    expect(page).toContain("confirmedId");
    expect(page).toContain("to review or correct");
  });
});

/**
 * The one-pupil view must not bounce the teacher back into the register.
 *
 * Marking a pupil collapses their row 900ms later, which removes them from
 * `visibleStudents`. The overlay used to resolve its pupil out of that same
 * list, so the instant you tapped a status the pupil vanished and you were
 * dropped into the rows again, mid-roll. These assertions pin the reason it
 * holds now: the pupil comes from `students`, the un-collapsed class list.
 */
describe("one-pupil view stays put", () => {
  it("resolves the focused pupil from the class, not the collapsing list", () => {
    expect(page).toContain("focusStudentId ? (students.find((s) => s.id === focusStudentId) ?? null) : null");
    expect(page).not.toContain("visibleStudents.findIndex((s) => s.id === focusStudentId) : -1;\n  const focusStudent");
  });

  it("is swipeable like the register, and says so", () => {
    // Both gestures reach the same markAttendance the register uses, so the
    // muscle memory carries over instead of having to be re-learned.
    expect(page).toMatch(
      /focusStudent\.id[^)]*onSwipeRight|onSwipeRight=\{\(\) => markFocusAndAdvance\(focusStudent\.id/,
    );
    expect(page).toContain("onSwipeLeft={() => markFocusAndAdvance(focusStudent.id, leftSwipeStatus())}");
    expect(page).toContain("onTap={() => markFocusAndAdvance(focusStudent.id, tapStatus(focusStatus))}");
    // Same reveal/action pairing as the register rows: red for Absent on the
    // right, green for Present on the left.
    expect(page).toContain("rightAction={ABSENT_SWIPE}");
    expect(page).toContain("leftAction={PRESENT_SWIPE}");
  });

  it("swipes left for Present and right for Absent, and leaves the rare marks to the buttons", () => {
    // These two are written on nearly every child, so they are the two the
    // gesture carries. Late and Excused are rare and are picked from the
    // buttons, where a stray thumb cannot set them.
    expect(page).toContain('function leftSwipeStatus(): AttendanceStatus {\n  return "present";\n}');
    expect(page).toContain('onSwipeRight={() => markAttendance(student.id, "absent")}');
    expect(page).toContain("onSwipeLeft={() => markAttendance(student.id, leftSwipeStatus())}");
    // The card carries all four marks as buttons.
    expect(page).toContain('{ key: "excused", label: "Excused"');
  });

  it("says what the swipe does with a colour and a buzz", () => {
    const swipe = fs.readFileSync(path.join(ROOT, "src/components/attendance/SwipeRow.tsx"), "utf8");
    // One pulse for Present, two for Absent.
    expect(swipe).toMatch(/PRESENT_SWIPE[\s\S]*?vibrate: 15/);
    expect(swipe).toMatch(/ABSENT_SWIPE[\s\S]*?vibrate: \[25, 45, 25\]/);
    // And the commit has to use it.
    expect(swipe).toContain("navigator.vibrate(pattern ?? 10)");
  });

  it("always offers a way out of the one-pupil view", () => {
    // A full-screen dialog that traps the teacher is a dialog they stop
    // opening: corner button, back link and Escape.
    expect(page).toContain("Close and go back to the register");
    expect(page).toContain('aria-label="Close and go back to the register"');
    expect(page).toContain('if (event.key === "Escape") setFocusStudentId(null)');
  });

  it("moves on to the next pupil by itself once one is marked", () => {
    expect(page).toContain("markFocusAndAdvance");
    expect(page).toContain("const nextUnmarked = list.findIndex((s, i) => i > current && !attendance[s.id]);");
  });

  it("offers every status as a large target, plus clear and next", () => {
    expect(page).toMatch(/STATUS_CYCLE\.map\(\(option\)/);
    // Thumb-sized, not a hairline button.
    expect(page).toContain("min-h-24");
    expect(page).toContain("min-h-14");
    expect(page).toContain("Next pupil");
  });
});

/**
 * The register is one list with two layouts.
 *
 * There is no <table> on this page, so the pupil list used to be the desktop
 * experience too. Redesigning it for a thumb would have silently handed desktop
 * users a stack of tall cards — the opposite of what a wide screen is for. Both
 * layouts now render from one map, and this pins the split so nobody deletes the
 * dense row believing it is dead code.
 */
describe("register adapts without losing desktop density", () => {
  it("renders a card for phones and a dense row for desktop", () => {
    expect(page).toContain("lg:hidden");
    expect(page).toMatch(/className="hidden[^\"]*lg:flex lg:items-center lg:gap-4/);
  });

  it("builds both from one pass over the pupils", () => {
    // Two .map() calls would let the two lists disagree about who is visible.
    const maps = page.match(/visibleStudents\.map\(/g) ?? [];
    expect(maps.length).toBe(1);
  });

  it("offers the same statuses on both layouts", () => {
    // One palette, so the phone card and the desktop row cannot drift apart.
    // Declared once, then used twice: handed to the phone card as a prop and
    // mapped by the desktop row.
    expect(page.match(/CARD_STATUSES/g) ?? []).toHaveLength(3);
    expect(page).toContain("statuses={CARD_STATUSES}");
    expect(page).toContain("{CARD_STATUSES.map((option) => {");
  });
});

describe("attendance desktop workspace stays flat", () => {
  it("uses one compact class/date rail instead of a selector card", () => {
    expect(page).toContain(
      'className="flex flex-col gap-3 border-b border-[var(--border)] py-3 sm:flex-row sm:items-end"',
    );
    expect(page).toContain('className="input h-10 text-sm"');
    expect(page).toContain('id="attendance-student-search"');
  });

  it("renders desktop pupils as separator rows, not individual cards", () => {
    const desktop = page.slice(page.indexOf("{/* Desktop */}"));
    expect(desktop).toContain("min-h-12 border-b border-[var(--border)]");
    expect(desktop).not.toContain(
      'className="hidden lg:flex lg:items-center lg:gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest',
    );
  });

  it("keeps one save action per viewport", () => {
    expect(page).toContain('className="hidden shadow-md shadow-navy/20 md:inline-flex"');
    expect(page).toContain("mobile-sticky-action fixed");
    expect(page).toContain("md:hidden");
  });
});

/**
 * The page was left mid-refactor by a previous session: the state was renamed to
 * `showTools` but the overflow menu still referenced the removed `overflowOpen`
 * and `showSmsSettings`, so the file did not compile. These pin that the menu and
 * its toggle are wired to state that exists.
 */
describe("the secondary tools menu is wired to state that exists", () => {
  it("no longer references the removed overflowOpen", () => {
    expect(page).not.toContain("overflowOpen");
  });

  it("has a state for the menu and one for the SMS toggle", () => {
    expect(page).toContain("const [showTools, setShowTools] = useState(false);");
    expect(page).toContain("const [showSmsSettings, setShowSmsSettings] = useState(false);");
  });
});
