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

/** Ring spinner — best for buttons & inline */
export function RingSpinner({ size = 20, color, className = "" }: SpinnerProps) {
  const c = color || "currentColor";
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="animate-spin-ring"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={c}
          strokeWidth="3"
          opacity="0.15"
        />
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

/** Dot pulse — best for "thinking" / message states */
export function DotPulse({ size = 24, color, className = "" }: SpinnerProps) {
  const c = color || "var(--navy)";
  const dotSize = Math.round(size / 5);
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className="animate-dot-pulse rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: c,
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .animate-dot-pulse {
          animation: dot-pulse 1.4s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}

/** Orbital dots — best for full-page loading */
export function OrbitalSpinner({ size = 48, color, className = "" }: SpinnerProps) {
  const c = color || "var(--navy)";
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 48 48" className="animate-orbital-spin">
        {Array.from({ length: 3 }).map((_, i) => {
          const angle = (i * 120 * Math.PI) / 180;
          const cx = 24 + 14 * Math.cos(angle);
          const cy = 24 + 14 * Math.sin(angle);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill={c}
              opacity={1 - i * 0.25}
              className="animate-orbital-fade"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          );
        })}
      </svg>
      <style jsx>{`
        @keyframes orbital-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes orbital-fade {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
        .animate-orbital-spin {
          animation: orbital-spin 2s linear infinite;
        }
        .animate-orbital-fade {
          animation: orbital-fade 1.2s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}

/** Circular progress with percentage */
export function CircularProgress({
  size = 48,
  progress,
  color,
  className = "",
}: SpinnerProps & { progress: number }) {
  const c = color || "var(--navy)";
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={c}
          opacity="0.12"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={c}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span
        className="absolute text-xs font-semibold"
        style={{ color: c }}
      >
        {Math.round(progress)}%
      </span>
    </span>
  );
}

/** Modern bar loader — best for top-of-page progress */
export function TopProgressBar({ progress, color }: { progress: number; color?: string }) {
  const c = color || "var(--navy)";
  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] h-[3px] bg-[var(--border)]">
      <div
        className="h-full transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          backgroundColor: c,
          boxShadow: `0 0 8px ${c}80`,
        }}
      />
      {progress < 100 && (
        <div
          className="absolute right-0 top-0 h-full w-16 animate-progress-shimmer"
          style={{
            background: `linear-gradient(90deg, transparent, ${c}, transparent)`,
          }}
        />
      )}
      <style jsx>{`
        @keyframes progress-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .animate-progress-shimmer {
          animation: progress-shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default RingSpinner;
