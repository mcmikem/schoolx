"use client";

import React from "react";

/* ────────────────────────────────────────────────────────────────
   SkoolMate OS — Modern Spinners
   ──────────────────────────────────────────────────────────────── */

interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

/** Ring spinner — best for buttons & inline.
    Canonical spinner: used by ui/Button and auth pages.
    (DotPulse / OrbitalSpinner / CircularProgress / TopProgressBar were
    removed: zero importers. ui/Skeleton's TopLoadingBar covers page progress.) */
export function RingSpinner({ size = 20, color, className = "" }: SpinnerProps) {
  const c = color || "currentColor";
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin-ring">
        <circle cx="12" cy="12" r="10" fill="none" stroke={c} strokeWidth="3" opacity="0.15" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          fill="none"
          stroke={c}
          strokeWidth="3"
          strokeLinecap="round"
          className="animate-spin-ring-path"
        />
      </svg>
      <style jsx>{`
        @keyframes spin-ring {
          to { transform: rotate(360deg); }
        }
        .animate-spin-ring {
          animation: spin-ring 0.9s linear infinite;
        }
        .animate-spin-ring-path {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: spin-ring-path 1.8s ease-in-out infinite;
        }
        @keyframes spin-ring-path {
          0% { stroke-dashoffset: 60; }
          50% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -60; }
        }
      `}</style>
    </span>
  );
}
