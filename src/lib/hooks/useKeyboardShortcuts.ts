"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true,
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape to work in inputs
        if (event.key !== "Escape") return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Common keyboard shortcuts for the app
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: "n", ctrl: true, action: () => {}, description: "New record" },
  { key: "s", ctrl: true, action: () => {}, description: "Save" },
  { key: "f", ctrl: true, action: () => {}, description: "Search" },
  { key: "Escape", action: () => {}, description: "Close modal" },
  {
    key: "h",
    ctrl: true,
    action: () => window.history.back(),
    description: "Go back",
  },
  {
    key: "l",
    ctrl: true,
    action: () => (window.location.href = "/dashboard"),
    description: "Go to dashboard",
  },
];
