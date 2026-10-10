"use client";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import MaterialIcon from "@/components/MaterialIcon";

/** Finger travel that commits a swipe. Below this the row snaps back. */
export const SWIPE_COMMIT_PX = 80;

/** Pure swipe resolution — tested directly, no DOM needed. */
export function resolveSwipe(dx: number): "present" | "absent" | null {
  if (dx >= SWIPE_COMMIT_PX) return "present";
  if (dx <= -SWIPE_COMMIT_PX) return "absent";
  return null;
}

interface SwipeRowProps {
  id?: string;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  /** Plain taps fall through to this (the browser click still fires). */
  onTap: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Roll-call swipe row: swipe right marks Present, swipe left marks Absent,
 * tap keeps whatever onTap does (usually cycling all four statuses).
 *
 * Gesture handling uses NATIVE touch listeners (not React synthetic ones) so
 * the move listener can be non-passive: once horizontal intent locks in, it
 * calls preventDefault() to claim the gesture. Without that claim, mobile
 * browsers hand the touch to the scroller mid-drag — the row follows the
 * finger for a beat, then dies, which reads as "swipe doesn't work". A
 * `touch-action: pan-y` style alone does not hold the gesture reliably once
 * the OS scroll heuristics engage (typically right after the first touch).
 *
 * - Vertical intent that wins first abandons the swipe: lists never trap
 *   the scroll, and direction locks so later wobble can't flip the call.
 * - The click after a committed swipe is swallowed — without this the tap
 *   handler would fire right after the swipe and undo it.
 * - Transform is written straight to the DOM (no re-render per pixel); only
 *   the reveal direction is state.
 */
export function SwipeRow({ id, onSwipeRight, onSwipeLeft, onTap, className = "", children }: SwipeRowProps) {
  const fgRef = useRef<HTMLDivElement>(null);
  const [lean, setLean] = useState<0 | 1 | -1>(0);
  // Mutable gesture machine + latest commit callbacks. Refs (never state) so
  // the natively-attached listeners below always see fresh values without
  // re-subscribing every render.
  const machine = useRef<{
    start: { x: number; y: number } | null;
    dir: 0 | 1 | -1;
    suppressClick: boolean;
    actions: { onSwipeRight: () => void; onSwipeLeft: () => void };
  }>({ start: null, dir: 0, suppressClick: false, actions: { onSwipeRight, onSwipeLeft } });
  machine.current.actions = { onSwipeRight, onSwipeLeft };

  useEffect(() => {
    const el = fgRef.current;
    if (!el) return;
    const m = machine.current;

    const setOffset = (dx: number, animate: boolean) => {
      el.style.transition = animate ? "" : "none";
      el.style.transform = dx === 0 ? "" : `translateX(${dx}px)`;
    };
    const reset = () => {
      m.start = null;
      m.dir = 0;
      setOffset(0, true);
      setLean(0);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      m.start = { x: t.clientX, y: t.clientY };
      m.dir = 0;
    };

    const onMove = (e: TouchEvent) => {
      const start = m.start;
      if (!start || m.dir === -1) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (m.dir === 0) {
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
          // Vertical intent won first — hands off to the scroll.
          m.dir = -1;
          reset();
          return;
        }
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) m.dir = 1;
      }
      if (m.dir === 1) {
        // Horizontal intent locked: claim the gesture so the browser cannot
        // hand it to the scroller halfway through the drag.
        e.preventDefault();
      }
      setOffset(dx, false);
      const next = (dx > 24 ? 1 : dx < -24 ? -1 : 0) as 0 | 1 | -1;
      setLean((prev) => (prev === next ? prev : next));
    };

    const commit = (dx: number) => {
      const action = resolveSwipe(dx);
      if (!action) return;
      m.suppressClick = true;
      if (typeof navigator.vibrate === "function") navigator.vibrate(10);
      if (action === "present") m.actions.onSwipeRight();
      else m.actions.onSwipeLeft();
    };

    const onEnd = (e: TouchEvent) => {
      const start = m.start;
      const dead = m.dir === -1;
      const dx = start ? e.changedTouches[0].clientX - start.x : 0;
      reset();
      if (!start || dead) return;
      commit(dx);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", reset);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", reset);
    };
  }, []);

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Rows can contain their own buttons (e.g. the desktop list's explicit
    // status buttons) — those handle themselves; the row tap is only for
    // presses on the row body. Either way the post-swipe flag is consumed.
    const fromControl = !!(e.target as HTMLElement).closest("button, a, input, select, textarea");
    const suppressed = machine.current.suppressClick;
    machine.current.suppressClick = false;
    if (suppressed || fromControl) return;
    onTap();
  };

  return (
    <div id={id} className="relative overflow-hidden rounded-xl select-none" style={{ touchAction: "pan-y" }}>
      <div
        aria-hidden="true"
        // Decorative reveal MUST stay out of hit-testing: it blankets the
        // whole row, and without pointer-events:none every touch lands on it
        // and bubbles past the foreground div — silently killing swipe AND
        // tap on real devices (jsdom tests dispatch directly, so they never
        // caught it). Pinned by the regression test below.
        className="absolute inset-0 flex items-center justify-between px-5 rounded-xl text-sm font-bold text-white pointer-events-none"
        style={{ background: lean > 0 ? "#059669" : lean < 0 ? "#dc2626" : "transparent" }}
      >
        <span className="flex items-center gap-1" style={{ opacity: lean > 0 ? 1 : 0 }}>
          <MaterialIcon icon="check_circle" className="text-lg" />
          Present
        </span>
        <span className="flex items-center gap-1" style={{ opacity: lean < 0 ? 1 : 0 }}>
          Absent
          <MaterialIcon icon="cancel" className="text-lg" />
        </span>
      </div>
      <div ref={fgRef} onClick={handleClick} className={className}>
        {children}
      </div>
    </div>
  );
}
