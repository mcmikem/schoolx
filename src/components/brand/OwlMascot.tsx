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
};

export default function OwlMascot({
  size = 64,
  className,
  ring = false,
  glow = false,
  premium = false,
  label,
  subtitle,
  animated = false,
}: OwlMascotProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        label ? "gap-3" : "",
        className,
      )}
    >
      <div className="relative">
        {glow && (
          <div
            className={cn(
              "absolute inset-[-10%] rounded-[28%] blur-2xl opacity-70",
              premium
                ? "bg-[radial-gradient(circle,_rgba(200,168,87,0.38),_rgba(11,28,57,0.08)_70%,_transparent_100%)]"
                : "bg-[radial-gradient(circle,_rgba(46,148,72,0.18),_rgba(11,28,57,0.06)_72%,_transparent_100%)]",
            )}
          />
        )}
        {ring && (
          <div
            className={cn(
              "absolute inset-[-10px] rounded-[30%] border",
              premium
                ? "border-[#d6c08a]/70 shadow-[0_0_0_1px_rgba(200,168,87,0.18)]"
                : "border-[var(--border)]/80",
              animated ? "animate-pulse" : "",
            )}
          />
        )}
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-[28%]",
            premium
              ? "bg-[linear-gradient(180deg,#102341_0%,#0b1c39_100%)] shadow-[0_18px_40px_rgba(7,18,40,0.22)]"
              : "bg-transparent",
          )}
          style={{ width: size, height: size }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/SkoolMate logos/SchoolMate icon.svg"
            alt="SkoolMate owl mascot"
            width={size}
            height={size}
            className={cn(
              "block h-full w-full object-contain",
              animated ? "animate-fade-in" : "",
            )}
            loading="eager"
            decoding="sync"
          />
        </div>
      </div>
      {label && (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--t1)]">{label}</div>
          {subtitle && (
            <div className="text-xs text-[var(--t3)] leading-5">{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}