"use client";

import { cn } from "@/lib/utils";

type OwlMascotProps = {
  size?: number;
  className?: string;
  ring?: boolean;
  glow?: boolean;
  premium?: boolean;
  label?: string;
  subtitle?: string;
  animated?: boolean;
  /** Drop the eye lids for a moment now and then. Defaults to `animated`. */
  blink?: boolean;
};

/**
 * The two eye lids, positioned over the owl's eye whites.
 *
 * The mascot is an image, so the lids are separate elements laid on top. The
 * positions are percentages of the artwork's 325 x 324 viewBox, which keeps
 * them aligned at any size. `OwlAssistant` uses this directly for its launcher,
 * which draws the image itself.
 */
export function OwlEyelids() {
  return (
    <>
      <span
        className="owly-eyelid"
        style={{ left: "20.3%", top: "42.3%", width: "27.7%", height: "28%" }}
        aria-hidden
      />
      <span className="owly-eyelid" style={{ left: "52.3%", top: "42.3%", width: "28%", height: "28%" }} aria-hidden />
    </>
  );
}

export default function OwlMascot({
  size = 64,
  className,
  ring = false,
  glow = false,
  premium = false,
  label,
  subtitle,
  animated = false,
  blink,
}: OwlMascotProps) {
  const shouldBlink = blink ?? animated;
  return (
    <div className={cn("relative inline-flex items-center justify-center", label ? "gap-3" : "", className)}>
      <div className="relative">
        {glow && (
          <div
            className={cn(
              "absolute inset-[-10%] rounded-[28%] blur-2xl opacity-70",
              premium ? "bg-[rgba(200,168,87,0.38)]" : "bg-[rgba(46,148,72,0.18)]",
            )}
          />
        )}
        {ring && (
          <div
            className={cn(
              "absolute inset-[-10px] rounded-[30%] border",
              premium ? "border-[#d6c08a]/70 shadow-[0_0_0_1px_rgba(200,168,87,0.18)]" : "border-[var(--border)]/80",
              animated ? "animate-pulse" : "",
            )}
          />
        )}
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-[28%]",
            premium ? "bg-[#102341] shadow-[0_18px_40px_rgba(7,18,40,0.22)]" : "bg-transparent",
          )}
          style={{ width: size, height: size }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/SkoolMate logos/SchoolMate icon.svg"
            alt="SkoolMate owl mascot"
            width={size}
            height={size}
            className={cn("block h-full w-full object-contain", animated ? "animate-fade-in" : "")}
            loading="eager"
            decoding="sync"
          />
          {shouldBlink && <OwlEyelids />}
        </div>
      </div>
      {label && (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--t1)]">{label}</div>
          {subtitle && <div className="text-xs text-[var(--t3)] leading-5">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
