import { render, screen, fireEvent } from "@testing-library/react";
import { SwipeRow, resolveSwipe, SWIPE_COMMIT_PX } from "@/components/attendance/SwipeRow";

describe("resolveSwipe", () => {
  it("commits Present on a right swipe past the threshold", () => {
    expect(resolveSwipe(SWIPE_COMMIT_PX)).toBe("present");
    expect(resolveSwipe(SWIPE_COMMIT_PX + 120)).toBe("present");
  });

  it("commits Absent on a left swipe past the threshold", () => {
    expect(resolveSwipe(-SWIPE_COMMIT_PX)).toBe("absent");
    expect(resolveSwipe(-SWIPE_COMMIT_PX - 120)).toBe("absent");
  });

  it("snaps back without committing inside the threshold", () => {
    expect(resolveSwipe(0)).toBeNull();
    expect(resolveSwipe(SWIPE_COMMIT_PX - 1)).toBeNull();
    expect(resolveSwipe(-(SWIPE_COMMIT_PX - 1))).toBeNull();
  });
});

function swipe(element: HTMLElement, fromX: number, toX: number) {
  fireEvent.touchStart(element, { touches: [{ clientX: fromX, clientY: 100 }] });
  fireEvent.touchMove(element, { touches: [{ clientX: (fromX + toX) / 2, clientY: 100 }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: toX, clientY: 100 }] });
}

function renderRow(handlers: { onSwipeRight?: () => void; onSwipeLeft?: () => void; onTap?: () => void }) {
  const onSwipeRight = handlers.onSwipeRight ?? jest.fn();
  const onSwipeLeft = handlers.onSwipeLeft ?? jest.fn();
  const onTap = handlers.onTap ?? jest.fn();
  render(
    <SwipeRow onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} onTap={onTap}>
      <span>Jane Doe</span>
    </SwipeRow>,
  );
  // The foreground div is the tap/swipe surface (parent of the content).
  const surface = screen.getByText("Jane Doe").parentElement as HTMLElement;
  return { surface, onSwipeRight, onSwipeLeft, onTap };
}

describe("SwipeRow", () => {
  it("marks Present on a long right swipe and swallows the follow-up click", () => {
    const { surface, onSwipeRight, onSwipeLeft, onTap } = renderRow({});
    swipe(surface, 50, 50 + SWIPE_COMMIT_PX + 40);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    // The tap handler must not fire right after a committed swipe.
    fireEvent.click(surface);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("marks Absent on a long left swipe", () => {
    const { surface, onSwipeRight, onSwipeLeft } = renderRow({});
    swipe(surface, 300, 300 - SWIPE_COMMIT_PX - 40);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("treats a short drag as a tap (existing cycle behaviour preserved)", () => {
    const { surface, onSwipeRight, onSwipeLeft, onTap } = renderRow({});
    swipe(surface, 100, 100 + SWIPE_COMMIT_PX - 20);

    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    fireEvent.click(surface);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("ignores a mostly-vertical gesture so lists keep scrolling", () => {
    const { surface, onSwipeRight, onSwipeLeft } = renderRow({});
    fireEvent.touchStart(surface, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(surface, { touches: [{ clientX: 120, clientY: 250 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 120, clientY: 250 }] });

    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("lets inner buttons handle their own taps (desktop rows)", () => {
    const onTap = jest.fn();
    const onSwipeRight = jest.fn();
    const onSwipeLeft = jest.fn();
    render(
      <SwipeRow onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} onTap={onTap}>
        <span>Jane Doe</span>
        <button type="button">Mark present</button>
      </SwipeRow>,
    );
    const innerButton = screen.getByText("Mark present");

    fireEvent.click(innerButton);

    // The row tap must not fire — the button owns that press.
    expect(onTap).not.toHaveBeenCalled();
    // But the row body still taps through.
    fireEvent.click(screen.getByText("Jane Doe"));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
