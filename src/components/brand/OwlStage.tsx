"use client";

import OwlMascot from "@/components/brand/OwlMascot";
import MaterialIcon from "@/components/MaterialIcon";
import { cn } from "@/lib/utils";

type OwlStageProps = {
  eyebrow?: string;
  title: string;
  description: string;
  chips?: string[];
  align?: "left" | "center";
  compact?: boolean;
  className?: string;
};

export default function OwlStage({
  eyebrow = "SkoolMate guide",
  title,
  description,
  chips = [],
  align = "left",
  compact = false,
  className,
}: OwlStageProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-[#dde5f0] bg-[linear-gradient(180deg,rgba(254,252,247,0.98)_0%,rgba(246,242,232,0.94)_100%)] p-6 shadow-[0_28px_70px_rgba(11,28,57,0.12)]",
        compact ? "p-5" : "p-6 sm:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(199,170,93,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(46,148,72,0.12),transparent_30%)]" />
      <div className="relative flex flex-col gap-5">
        <div
          className={cn(
            "flex flex-col gap-4",
            centered ? "items-center text-center" : "items-start text-left",
          )}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d5ddE8] bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#34507a] shadow-sm">
            <MaterialIcon icon="auto_stories" className="text-[15px]" />
            {eyebrow}
          </span>
          <div
            className={cn(
              "flex gap-4",
              compact ? "items-center" : "items-start",
              centered ? "flex-col items-center" : "flex-col sm:flex-row",
            )}
          >
            <OwlMascot
              size={compact ? 76 : 92}
              premium
              ring
              glow
              animated
              className="shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-['Sora'] text-[26px] font-semibold tracking-[-0.03em] text-[#102341] sm:text-[32px]">
                {title}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#53657f] sm:text-[15px]">
                {description}
              </p>
            </div>
          </div>
          {chips.length > 0 && (
            <div
              className={cn(
                "flex flex-wrap gap-2.5",
                centered ? "justify-center" : "justify-start",
              )}
            >
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full border border-[#dce4ee] bg-white/92 px-3 py-2 text-xs font-semibold text-[#314866] shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c7aa5d]" />
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}