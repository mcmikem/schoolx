"use client";
import { useEffect, useRef, useState, ReactNode } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Never risk hiding content. Three ways out, in order of preference:
    //  1. reduced-motion users get it immediately, with no transform
    //  2. IntersectionObserver reveals it when it scrolls into view
    //  3. a timeout reveals it regardless, so a slow/absent observer on a
    //     low-end phone can never leave a section blank
    let settle: number | undefined;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setVisible(true);
      if (settle) window.clearTimeout(settle);
    };

    let reducedMotion = false;
    try {
      reducedMotion = window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
    } catch {
      reducedMotion = false;
    }

    if (reducedMotion) {
      reveal();
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    settle = window.setTimeout(reveal, 1500);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      // A generous rootMargin means content is already animating in before it
      // reaches the fold, which reads as instant on a slow device.
      { threshold: 0.05, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (settle) window.clearTimeout(settle);
    };
  }, []);

  // Lite mode strips transitions globally for low-end devices; keep the class
  // list simple so nothing depends on the animation actually running.
  return (
    <div
      ref={ref}
      className={`transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"} ${className}`}
      style={visible && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
