"use client";

import MaterialIcon from "@/components/MaterialIcon";

/**
 * One loading affordance for the whole app.
 *
 * Three sizes:
 *  - "screen": full-page (dashboard boot, login restore)
 *  - "section": inline card/section placeholder
 *  - "inline": small inline spinner for buttons and rows
 *
 * Always uses the same spinner, the same colour, and the same copy pattern
 * so users never wonder "is this the same loading or a different one?".
 */
export default function LoadingState({
  size = "section",
  label = "Loading…",
}: {
  size?: "screen" | "section" | "inline";
  label?: string;
}) {
  if (size === "screen") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--bg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <p className="text-sm font-medium text-[var(--t2)]">{label}</p>
      </div>
    );
  }
  if (size === "inline") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[var(--t3)]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        {label}
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      <p className="text-sm text-[var(--t2)]">{label}</p>
    </div>
  );
}
