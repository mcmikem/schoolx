"use client";

import { useEffect, useCallback, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface Shortcut {
  key: string;
  modifiers?: ("ctrl" | "alt" | "shift" | "meta")[];
  label: string;
  action?: () => void;
  description?: string;
  /** Scope where shortcut is active (default: global) */
  scope?: "global" | "dashboard" | "students" | "fees" | "attendance";
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  shortcuts?: Shortcut[];
}

function KeyboardShortcutsProvider({
  children,
  shortcuts = [],
}: KeyboardShortcutsProviderProps) {
  const [showHint, setShowHint] = useState(false);
  const [hintTimeout, setHintTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for modifier keys
      const hasCtrl = e.ctrlKey || e.metaKey;
      const hasAlt = e.altKey;
      const hasShift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Skip if in input/textarea unless Ctrl is pressed
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable;

      if (isInput && !hasCtrl) return;

      e.preventDefault();

      // Find matching shortcut
      for (const shortcut of shortcuts) {
        const keyMatch = shortcut.key === key;
        const modifiersMatch =
          !shortcut.modifiers ||
          (shortcut.modifiers.includes("ctrl") === hasCtrl &&
            shortcut.modifiers.includes("alt") === hasAlt &&
            shortcut.modifiers.includes("shift") === hasShift) ||
          (!hasCtrl && !hasAlt && !hasShift && !shortcut.modifiers);

        if (keyMatch && modifiersMatch) {
          shortcut.action?.();
          break;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    // Show hint when user presses ?
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "?" && (e.shiftKey || e.key === "/")) {
        setShowHint(true);
        if (hintTimeout) clearTimeout(hintTimeout);
        hintTimeout = window.setTimeout(() => setShowHint(false), 5000);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [hintTimeout]);

  return (
    <>
      {children}
      {showHint && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[var(--surface)] px-4 py-2 rounded-xl text-[var(--on-surface)] text-xs z-[9999] border border-[var(--border)] shadow-lg">
          <MaterialIcon icon="keyboard" className="mr-1" /> Keyboard shortcuts:
          ?
        </div>
      )}
    </>
  );
}

export function useKeyboardShortcuts() {
  // Hook for components to register their shortcuts
  return null; // Simplified for now
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    key: "k",
    modifiers: ["ctrl"],
    label: "Search",
    description: "Open search",
  },
  {
    key: "/",
    modifiers: ["alt"],
    label: "Focus Search",
    description: "Quick search",
  },
  {
    key: "s",
    modifiers: ["ctrl", "shift"],
    label: "Save",
    description: "Save current form",
  },
  {
    key: "n",
    modifiers: ["ctrl", "shift"],
    label: "New",
    description: "Create new item",
  },
  {
    key: "ArrowUp",
    modifiers: [],
    label: "Previous",
    description: "Select previous item",
  },
  {
    key: "ArrowDown",
    modifiers: [],
    label: "Next",
    description: "Select next item",
  },
  {
    key: "Escape",
    modifiers: [],
    label: "Cancel",
    description: "Close modal/dropdown",
  },
];

KeyboardShortcutsProvider.displayName = "KeyboardShortcutsProvider";
