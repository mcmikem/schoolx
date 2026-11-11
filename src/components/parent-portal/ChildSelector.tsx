"use client";

import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";
import type { ParentPortalChild } from "@/lib/parent-portal";

function ChipAvatar({ child }: { child: ParentPortalChild }) {
  const [failed, setFailed] = useState(false);
  const photo = child.photo_url || child.avatar_url;
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <span aria-hidden="true" className="text-[11px] font-semibold text-[var(--t3)]">
      {child.first_name?.[0]}
      {child.last_name?.[0]}
    </span>
  );
}

/**
 * The child switcher. A parent with two children at the school should be able
 * to change who they are looking at without leaving the page, and should be
 * able to see *which* child is selected without reading a label.
 */
export function ChildSelector({ label = "child" }: { label?: string }) {
  const { children, selectedChild, setSelectedChild } = useParentPortal();

  if (children.length === 0) return null;

  return (
    <div className="min-w-0">
      <div
        role="group"
        aria-label={`Choose ${label}`}
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
      >
        {children.map((child) => {
          const active = selectedChild?.id === child.id;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedChild(child)}
              aria-pressed={active}
              aria-label={`Show ${child.first_name} ${child.last_name}`}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] transition-colors ${
                active
                  ? "border-[var(--primary)]/30 bg-[var(--primary-50)] font-semibold text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                  active ? "bg-[var(--surface)]" : "bg-[var(--surface-container-low)]"
                }`}
              >
                <ChipAvatar child={child} />
              </span>
              <span className="max-w-[9.5rem] truncate">{child.first_name}</span>
              {active && <MaterialIcon icon="check" size={15} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
