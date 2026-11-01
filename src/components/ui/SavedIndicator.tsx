"use client";

import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

/**
 * A small "Saved ✓" affordance that appears after a successful write and
 * fades out. Use it next to any save action so the user always knows their
 * work landed — especially important on flaky connections and offline.
 *
 * Usage:
 *   const [savedAt, setSavedAt] = useState<number | null>(null);
 *   // after a successful save: setSavedAt(Date.now());
 *   <SavedIndicator savedAt={savedAt} />
 */
export default function SavedIndicator({ savedAt, label = "Saved" }: { savedAt: number | null; label?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (!visible) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--green-ink)] animate-fade-in">
      <MaterialIcon icon="check_circle" size={14} className="text-[var(--green)]" />
      {label}
    </span>
  );
}
