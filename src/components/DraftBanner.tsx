"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DraftBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
  visible?: boolean;
}

export function DraftBanner({ onRestore, onDismiss, visible = true }: DraftBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setDismissed(true), 10000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg",
        "border-[var(--primary)]/30 bg-[var(--primary)]/10 backdrop-blur-sm",
        "animate-slide-up",
      )}
    >
      <span className="material-symbols-outlined text-sm text-[var(--primary)]">
        save
      </span>
      <span className="text-sm font-medium text-[var(--t1)]">
        Unsaved draft found
      </span>
      <button
        onClick={onRestore}
        className="rounded-md bg-[var(--primary)] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
      >
        Restore
      </button>
      <button
        onClick={() => {
          setDismissed(true);
          onDismiss();
        }}
        className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--t2)] hover:bg-[var(--bg)]"
      >
        Dismiss
      </button>
    </div>
  );
}
