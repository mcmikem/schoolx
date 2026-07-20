"use client";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  badge?: string | number | null;
  className?: string;
  headerClassName?: string;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  storageKey,
  badge,
  className = "",
  headerClassName = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsOpen(stored === "true");
      }
    } catch {}
  }, [storageKey]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {}
      }
      return next;
    });
  }, [storageKey]);

  const sectionId = `collapsible-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <button
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 rounded ${headerClassName}`}
        aria-expanded={isOpen}
        aria-controls={sectionId}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h3>
          {badge != null && (
            <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              {badge}
            </span>
          )}
        </div>
        <MaterialIcon
          icon={isOpen ? "expand_less" : "expand_more"}
          className="shrink-0 text-lg text-gray-400 dark:text-gray-500"
        />
      </button>

      {isOpen && (
        <div id={sectionId} className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}
