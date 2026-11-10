"use client";

import { useState } from "react";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import type { ParentPortalChild } from "@/lib/parent-portal";

function ChipAvatar({ child }: { child: ParentPortalChild }) {
  const [failed, setFailed] = useState(false);
  if (child.photo_url && !failed) {
    return (
      <img
        src={child.photo_url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-xs font-bold text-[var(--on-surface-variant)]">
      {child.first_name?.[0]}
    </span>
  );
}

export function ChildSelector({ label = "Learner" }: { label?: string }) {
  const { children, selectedChild, setSelectedChild } = useParentPortal();

  if (children.length === 0) return null;

  return (
    <div className="min-w-0">
      <div role="group" aria-label={`Select ${label.toLowerCase()}`} className="flex gap-3 overflow-x-auto pb-1">
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => setSelectedChild(child)}
            aria-pressed={selectedChild?.id === child.id}
            aria-label={`Select ${child.first_name} ${child.last_name}`}
            className={`flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              selectedChild?.id === child.id
                ? "border-transparent bg-[var(--primary)] text-[var(--on-primary)] shadow-[var(--sh1)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-container)] text-xs font-bold text-[var(--t2)]">
              <ChipAvatar child={child} />
            </span>
            <span className="max-w-[12rem] truncate">
              {child.first_name} {child.last_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
