import { fireEvent, render, screen, within } from "@testing-library/react";

import { AttendanceMarkCard } from "@/components/attendance/AttendanceMarkCard";
import { ABSENT_SWIPE, LATE_SWIPE } from "@/components/attendance/SwipeRow";

/**
 * Marking must not require learning a gesture.
 *
 * The register used to cycle a pupil's status on tap, so the only way to record
 * "Late" was to know that the third tap was Late. That is exactly the kind of
 * thing a teacher has to stop and ask about. The card prints every status at a
 * size a thumb can hit, and these tests hold it to that.
 */

const STATUSES = [
  { key: "present", label: "Present", icon: "check_circle", activeBg: "bg-green-600", activeText: "text-white" },
  { key: "absent", label: "Absent", icon: "cancel", activeBg: "bg-red-600", activeText: "text-white" },
  { key: "late", label: "Late", icon: "schedule", activeBg: "bg-amber-600", activeText: "text-white" },
];

const student = { id: "s1", first_name: "Nakato", last_name: "Amina", student_number: "P3-001" };

function renderCard(over: Partial<React.ComponentProps<typeof AttendanceMarkCard>> = {}) {
  const onMark = jest.fn();
  const onTapCycle = jest.fn();
  render(
    <AttendanceMarkCard
      student={student}
      onMark={onMark}
      onTapCycle={onTapCycle}
      leftAction={LATE_SWIPE}
      rightAction={ABSENT_SWIPE}
      onSwipeLeft={jest.fn()}
      onSwipeRight={jest.fn()}
      statuses={STATUSES}
      {...over}
    />,
  );
  return { onMark, onTapCycle };
}

describe("every status is reachable by tapping, in one go", () => {
  it("offers each status as its own labelled control", () => {
    renderCard();
    for (const status of STATUSES) {
      // One control each: no cycling, no "tap three times".
      expect(screen.getByRole("button", { name: new RegExp(status.label, "i") })).toBeInTheDocument();
    }
  });

  it("marks exactly the status tapped, not the next one in a cycle", () => {
    const { onMark } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Absent/i }));
    expect(onMark).toHaveBeenCalledWith("absent");
  });

  it("marks Late directly rather than requiring taps", () => {
    const { onMark } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Late/i }));
    expect(onMark).toHaveBeenCalledWith("late");
  });

  it("gives the controls a thumb-sized target", () => {
    renderCard();
    const button = screen.getByRole("button", { name: /Present/i });
    expect(button.className).toMatch(/min-h-\[5\dpx\]/);
  });

  it("shows the current status as pressed", () => {
    renderCard({ status: "absent" });
    expect(screen.getByRole("button", { name: /Absent/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Present/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows nothing pressed for an unmarked pupil, never a fake Present", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /Present/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("still cycles on a tap of the card body, for speed", () => {
    const { onTapCycle } = renderCard();
    fireEvent.click(screen.getByText("Nakato Amina"));
    expect(onTapCycle).toHaveBeenCalled();
  });
});

describe("one pupil at a time", () => {
  it("opens the focused view without also marking the child", () => {
    // The card tap marks a pupil. Focusing one is a different intent, and
    // letting it bubble would set someone's status as a side effect of
    // navigating -- the kind of error a teacher would not notice for a week.
    const onFocus = jest.fn();
    const onTapCycle = jest.fn();
    renderCard({ onFocus, onTapCycle });
    fireEvent.click(screen.getByRole("button", { name: /on their own screen/i }));
    expect(onFocus).toHaveBeenCalled();
    expect(onTapCycle).not.toHaveBeenCalled();
  });

  it("hides the focus control when there is nowhere to focus", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: /on their own screen/i })).toBeNull();
  });
});

describe("the pupil is identifiable", () => {
  it("shows the full name", () => {
    renderCard();
    expect(screen.getByText("Nakato Amina")).toBeInTheDocument();
  });

  it("shows the admission number", () => {
    renderCard();
    expect(screen.getByText("P3-001")).toBeInTheDocument();
  });
});
