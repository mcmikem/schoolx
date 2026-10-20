"use client";

import React from "react";

/* ────────────────────────────────────────────────────────────────
   SkoolMate OS — Animated Owl Loader (Brand-Accurate)
   Colors match the SchoolMate logo exactly:
   • Navy  OWL_NAVY  (primary)
   • White var(--surface)  (secondary)
   • Gold  OWL_GOLD  (accent)
   Pure vector, no external images. Works offline.
   ──────────────────────────────────────────────────────────────── */

const OWL_NAVY = "#0b1c39";
const OWL_NAVY_MID = "#0f203b";
const OWL_GOLD = "#c8a857";
const OWL_GOLD_DARK = "#b8943f";

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
        <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg)] ${className}`}>
          {children}
        </div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className={`flex flex-col items-center justify-center ${className}`}>{children}</div>
      );

  return (
    <Wrapper>
      <div className="relative" style={{ width: s, height: s }}>
        <svg viewBox="0 0 120 120" width={s} height={s} className="animate-owl-float">
          <defs>
            <linearGradient id="owlBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="OWL_NAVY_MID" />
              <stop offset="100%" stopColor="OWL_NAVY" />
            </linearGradient>
            <linearGradient id="owlBelly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--surface)" />
              <stop offset="100%" stopColor="#f5f7fa" />
            </linearGradient>
            <linearGradient id="bookCover" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="OWL_GOLD" />
              <stop offset="100%" stopColor="OWL_GOLD_DARK" />
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="OWL_NAVY" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Shadow */}
          <ellipse cx="60" cy="108" rx="28" ry="6" fill="OWL_NAVY" opacity="0.12" className="animate-owl-shadow" />

          {/* Book (behind owl) */}
          <g className="animate-book-bounce">
            <rect x="38" y="78" width="44" height="14" rx="3" fill="url(#bookCover)" filter="url(#softShadow)" />
            <rect x="40" y="80" width="40" height="10" rx="2" fill="var(--surface)" opacity="0.25" />
            <line x1="60" y1="80" x2="60" y2="90" stroke="OWL_NAVY" strokeWidth="1.5" opacity="0.4" />
          </g>

          {/* Body */}
          <ellipse cx="60" cy="62" rx="32" ry="36" fill="url(#owlBody)" filter="url(#softShadow)" />

          {/* Belly */}
          <ellipse cx="60" cy="68" rx="22" ry="24" fill="url(#owlBelly)" />

          {/* Wings */}
          <ellipse cx="30" cy="64" rx="10" ry="18" fill="OWL_NAVY" className="animate-wing-left" />
          <ellipse cx="90" cy="64" rx="10" ry="18" fill="OWL_NAVY" className="animate-wing-right" />

          {/* Eyes container */}
          <g className="animate-owl-blink">
            {/* Left eye */}
            <circle cx="46" cy="50" r="14" fill="var(--surface)" />
            <circle cx="46" cy="50" r="14" fill="none" stroke="OWL_NAVY" strokeWidth="2" />
            <circle cx="48" cy="50" r="7" fill="OWL_NAVY" className="animate-pupil-left" />
            <circle cx="50" cy="48" r="2.5" fill="var(--surface)" />

            {/* Right eye */}
            <circle cx="74" cy="50" r="14" fill="var(--surface)" />
            <circle cx="74" cy="50" r="14" fill="none" stroke="OWL_NAVY" strokeWidth="2" />
            <circle cx="72" cy="50" r="7" fill="OWL_NAVY" className="animate-pupil-right" />
            <circle cx="74" cy="48" r="2.5" fill="var(--surface)" />
          </g>

          {/* Beak */}
          <path d="M 55 58 L 65 58 L 60 68 Z" fill="OWL_GOLD" />

          {/* Graduation cap — navy body, gold tassel */}
          <g className="animate-cap-wiggle">
            {/* Cap base band */}
            <rect x="42" y="18" width="36" height="7" rx="3" fill="OWL_NAVY" />
            {/* Cap top (mortarboard) */}
            <polygon points="38,18 82,18 74,8 46,8" fill="OWL_NAVY_MID" />
            {/* Tassel string */}
            <path d="M 74 13 Q 82 13 84 22" fill="none" stroke="OWL_GOLD" strokeWidth="2" strokeLinecap="round" />
            {/* Tassel end */}
            <circle cx="84" cy="24" r="3" fill="OWL_GOLD" />
            <circle cx="84" cy="24" r="1.5" fill="OWL_NAVY" opacity="0.3" />
          </g>

          {/* Feet */}
          <g fill="OWL_GOLD">
            <ellipse cx="48" cy="96" rx="6" ry="4" />
            <ellipse cx="72" cy="96" rx="6" ry="4" />
          </g>

          {/* Subtle chest feather detail */}
          <g opacity="0.08" stroke="OWL_NAVY" strokeWidth="1.5" strokeLinecap="round">
            <path d="M 54 72 Q 60 76 66 72" />
            <path d="M 52 78 Q 60 82 68 78" />
          </g>
        </svg>
      </div>

      {text && (
        <div className="mt-6 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[OWL_NAVY] tracking-tight">{text}</span>
            <span className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-[OWL_NAVY] animate-typing-dot" />
              <span
                className="h-2 w-2 rounded-full bg-[OWL_NAVY] animate-typing-dot"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 rounded-full bg-[OWL_NAVY] animate-typing-dot"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
          {subtext && <p className="text-sm text-[var(--t3)]">{subtext}</p>}
        </div>
      )}
    </Wrapper>
  );
}
