"use client";

import MaterialIcon from "@/components/MaterialIcon";
import { askOwly } from "@/lib/owly-bus";

/**
 * A small "Ask Owly" link for informational banners.
 *
 * The banner keeps the fact the user needs right now; the link hands the
 * explanation to Owly instead of growing the banner into a manual.
 */
export function OwlyHelpLink({
  question,
  label = "Ask Owly",
  className = "",
}: {
  question: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => askOwly({ kind: "ask", question })}
      className={`inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold underline decoration-current/40 underline-offset-2 ${className}`}
    >
      <MaterialIcon icon="help" size={16} />
      {label}
    </button>
  );
}
