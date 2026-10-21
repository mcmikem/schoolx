"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { askOwly } from "@/lib/owly-bus";

/**
 * The page's single entry point into Owly.
 *
 * Replaces the inline "How to…" cards. The copy lives in `owly-guides.ts`, so
 * this button carries no instructions of its own -- it just asks the guide to
 * explain the page. If Owly is not mounted (for example on a public page), the
 * fallback is the learning guide rather than a dead button.
 */
export function OwlyTrigger({
  guideId,
  label,
  className = "",
}: {
  guideId: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      data-owly-trigger={guideId}
      onClick={() => {
        if (!askOwly({ kind: "guide", guideId })) {
          router.push("/dashboard/learn/");
        }
      }}
      aria-label={`Ask Owly: ${label}`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)] ${className}`}
    >
      <Image
        src="/SkoolMate logos/SchoolMate icon.svg"
        alt=""
        width={18}
        height={18}
        loading="eager"
        className="rounded"
      />
      <span>{label}</span>
      <MaterialIcon icon="arrow_forward" size={16} className="text-[var(--t4)]" />
    </button>
  );
}
