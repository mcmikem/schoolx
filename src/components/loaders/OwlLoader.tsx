"use client";

import React from "react";

/* ────────────────────────────────────────────────────────────────
   SkoolMate OS — Animated Owl Loader (Brand-Accurate)
   Colors match the SchoolMate logo exactly:
   • Navy  #0b1c39  (primary)
   • White #ffffff  (secondary)
   • Gold  #c8a857  (accent)
   Pure vector, no external images. Works offline.
   ──────────────────────────────────────────────────────────────── */

interface OwlLoaderProps {
  size?: number;
  text?: string;
  subtext?: string;
  fullScreen?: boolean;
  className?: string;
}

export function OwlLoader({
  size = 120,
  text = "Loading",
  subtext,
  fullScreen = false,
  className = "",
}: OwlLoaderProps) {
  const s = size;

  const Wrapper = fullScreen
    ? ({ children }: { children: React.ReactNode }) => (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg)] ${className}`}
        >
          {children}
        </div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className={`flex flex-col items-center justify-center ${className}`}>
          {children}
        </div>
      );

  return (
    <Wrapper>
      <div className="relative" style={{ width: s, height: s }}>
        <svg
          viewBox="0 0 120 120"
          width={s}
          height={s}
          className="animate-owl-float"
        >
          <defs>
            <linearGradient id="owlBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f203b" />
              <stop offset="100%" stopColor="#0b1c39" />
            </linearGradient>
            <linearGradient id="owlBelly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f5f7fa" />
            </linearGradient>
            <linearGradient id="bookCover" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c8a857" />
              <stop offset="100%" stopColor="#b8943f" />
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0b1c39" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Shadow */}
          <ellipse
            cx="60"
            cy="108"
            rx="28"
            ry="6"
            fill="#0b1c39"
            opacity="0.12"
            className="animate-owl-shadow"
          />

          {/* Book (behind owl) */}
          <g className="animate-book-bounce">
            <rect x="38" y="78" width="44" height="14" rx="3" fill="url(#bookCover)" filter="url(#softShadow)" />
            <rect x="40" y="80" width="40" height="10" rx="2" fill="#ffffff" opacity="0.25" />
            <line x1="60" y1="80" x2="60" y2="90" stroke="#0b1c39" strokeWidth="1.5" opacity="0.4" />
          </g>

          {/* Body */}
          <ellipse cx="60" cy="62" rx="32" ry="36" fill="url(#owlBody)" filter="url(#softShadow)" />

          {/* Belly */}
          <ellipse cx="60" cy="68" rx="22" ry="24" fill="url(#owlBelly)" />

          {/* Wings */}
          <ellipse
            cx="30"
            cy="64"
            rx="10"
            ry="18"
            fill="#0b1c39"
            className="animate-wing-left"
          />
          <ellipse
            cx="90"
            cy="64"
            rx="10"
            ry="18"
            fill="#0b1c39"
            className="animate-wing-right"
          />

          {/* Eyes container */}
          <g className="animate-owl-blink">
            {/* Left eye */}
            <circle cx="46" cy="50" r="14" fill="#ffffff" />
            <circle cx="46" cy="50" r="14" fill="none" stroke="#0b1c39" strokeWidth="2" />
            <circle cx="48" cy="50" r="7" fill="#0b1c39" className="animate-pupil-left" />
            <circle cx="50" cy="48" r="2.5" fill="#ffffff" />

            {/* Right eye */}
            <circle cx="74" cy="50" r="14" fill="#ffffff" />
            <circle cx="74" cy="50" r="14" fill="none" stroke="#0b1c39" strokeWidth="2" />
            <circle cx="72" cy="50" r="7" fill="#0b1c39" className="animate-pupil-right" />
            <circle cx="74" cy="48" r="2.5" fill="#ffffff" />
          </g>

          {/* Beak */}
          <path
            d="M 55 58 L 65 58 L 60 68 Z"
            fill="#c8a857"
          />

          {/* Graduation cap — navy body, gold tassel */}
          <g className="animate-cap-wiggle">
            {/* Cap base band */}
            <rect x="42" y="18" width="36" height="7" rx="3" fill="#0b1c39" />
            {/* Cap top (mortarboard) */}
            <polygon
              points="38,18 82,18 74,8 46,8"
              fill="#0f203b"
            />
            {/* Tassel string */}
            <path
              d="M 74 13 Q 82 13 84 22"
              fill="none"
              stroke="#c8a857"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Tassel end */}
            <circle cx="84" cy="24" r="3" fill="#c8a857" />
            <circle cx="84" cy="24" r="1.5" fill="#0b1c39" opacity="0.3" />
          </g>

          {/* Feet */}
          <g fill="#c8a857">
            <ellipse cx="48" cy="96" rx="6" ry="4" />
            <ellipse cx="72" cy="96" rx="6" ry="4" />
          </g>

          {/* Subtle chest feather detail */}
          <g opacity="0.08" stroke="#0b1c39" strokeWidth="1.5" strokeLinecap="round">
            <path d="M 54 72 Q 60 76 66 72" />
            <path d="M 52 78 Q 60 82 68 78" />
          </g>
        </svg>
      </div>

      {text && (
        <div className="mt-6 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[#0b1c39] tracking-tight">
              {text}
            </span>
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-[#0b1c39] animate-typing-dot" />
              <span className="h-2 w-2 rounded-full bg-[#0b1c39] animate-typing-dot" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-[#0b1c39] animate-typing-dot" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
          {subtext && (
            <p className="text-sm text-[var(--t3)]">{subtext}</p>
          )}
        </div>
      )}
    </Wrapper>
  );
}

export default OwlLoader;
