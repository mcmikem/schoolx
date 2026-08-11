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
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-[10px] font-bold text-[var(--on-surface-variant)]">
      {child.first_name?.[0]}
    </span>
  );
}

export function ChildSelector({ label = "Learner" }: { label?: string }) {
  const { children, selectedChild, setSelectedChild } = useParentPortal();

  if (children.length <= 1) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => setSelectedChild(child)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border ${
              selectedChild?.id === child.id
                ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent shadow-[0_12px_24px_rgba(0,92,230,0.18)]"
                : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
            }`}
          >
            <ChipAvatar child={child} />
            {child.first_name} {child.last_name}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--t3)]">{label} data updates when you switch.</p>
    </div>
  );
}
