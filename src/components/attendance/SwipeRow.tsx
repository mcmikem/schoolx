"use client";
import { useRef, useState, type ReactNode, type TouchEvent } from "react";
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
 * - `touch-action: pan-y` keeps vertical scrolling native; only horizontal
 *   travel is intercepted, and a mostly-vertical gesture abandons the swipe
 *   so lists never trap the scroll.
 * - The click after a committed swipe is swallowed — without this the tap
 *   handler would fire right after the swipe and undo it.
 * - Transform is written straight to the DOM (no re-render per pixel); only
 *   the reveal direction is state.
 */
export function SwipeRow({ id, onSwipeRight, onSwipeLeft, onTap, className = "", children }: SwipeRowProps) {
  const fgRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const deadRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [lean, setLean] = useState<0 | 1 | -1>(0);

  const setOffset = (dx: number, animate: boolean) => {
    const el = fgRef.current;
    if (!el) return;
    el.style.transition = animate ? "" : "none";
    el.style.transform = dx === 0 ? "" : `translateX(${dx}px)`;
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    deadRef.current = false;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || deadRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      deadRef.current = true;
      setOffset(0, true);
      setLean(0);
      return;
    }
    setOffset(dx, false);
    const next = dx > 24 ? 1 : dx < -24 ? -1 : 0;
    setLean((prev) => (prev === next ? prev : (next as 0 | 1 | -1)));
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || deadRef.current) {
      setOffset(0, true);
      setLean(0);
      return;
    }
    const t = e.changedTouches[0];
    const action = resolveSwipe(t.clientX - start.x);
    setOffset(0, true);
    setLean(0);
    if (action) {
      suppressClickRef.current = true;
      if (typeof navigator.vibrate === "function") navigator.vibrate(10);
      if (action === "present") onSwipeRight();
      else onSwipeLeft();
    }
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onTap();
  };

  return (
    <div id={id} className="relative overflow-hidden rounded-xl select-none" style={{ touchAction: "pan-y" }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-between px-5 rounded-xl text-sm font-bold text-white"
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
      <div
        ref={fgRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}
