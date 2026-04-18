"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";

interface AriaAnnounceOptions {
  politeness?: "polite" | "assertive";
  timeout?: number;
}

export function useAriaLiveAnnouncer(
  message: string,
  options?: AriaAnnounceOptions,
) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (message) {
      setAnnouncement(message);
      const timeout = setTimeout(
        () => setAnnouncement(""),
        options?.timeout || 3000,
      );
      return () => clearTimeout(timeout);
    }
  }, [message, options?.timeout]);

  const announce = useCallback(
    (msg: string) => {
      setAnnouncement(msg);
      setTimeout(() => setAnnouncement(""), options?.timeout || 3000);
    },
    [options?.timeout],
  );

  return {
    announcement,
    announce,
    politeness: options?.politeness || "polite",
  };
}

export function AriaLiveRegion({
  message,
  politeness = "polite",
  className,
}: {
  message: string;
  politeness?: "polite" | "assertive";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={`sr-only ${className || ""}`}
    >
      {message}
    </div>
  );
}

export function SkipLink({
  targetId,
  children,
}: {
  targetId: string;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--primary)] focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
    >
      {children || `Skip to ${targetId}`}
    </a>
  );
}

export function FocusTrap({
  children,
  isActive,
  onEscape,
}: {
  children: ReactNode;
  isActive: boolean;
  onEscape?: () => void;
}) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onEscape]);

  if (!isActive) return <>{children}</>;

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function ColorContrastChecker() {
  const [isEnabled, setIsEnabled] = useState(false);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
    if (typeof window !== "undefined") {
      document.body.classList.toggle("high-contrast", !isEnabled);
    }
  }, [isEnabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "h") {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 p-2 bg-gray-800 text-white rounded-lg shadow-lg"
      aria-label="Toggle high contrast mode (Cmd+Shift+H)"
      title="Toggle high contrast mode"
    >
      <span className="sr-only">High Contrast</span>
      <span aria-hidden="true">◐</span>
    </button>
  );
}

export function ScreenReaderOnly({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`sr-only ${className || ""}`}>{children}</span>;
}

export function VisibleOnly({ children }: { children: ReactNode }) {
  return (
    <span className="hidden" aria-hidden="true">
      {children}
    </span>
  );
}

export function KeyboardNavigableGrid<T>({
  items,
  renderItem,
  onSelect,
  columns = 4,
  ariaLabel,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onSelect?: (item: T) => void;
  columns?: number;
  ariaLabel: string;
}) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + columns, items.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - columns, 0));
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(items.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (onSelect && items[focusedIndex]) {
            onSelect(items[focusedIndex]);
          }
          break;
      }
    },
    [items, columns, onSelect, focusedIndex],
  );

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          role="gridcell"
          tabIndex={index === focusedIndex ? 0 : -1}
          onFocus={() => setFocusedIndex(index)}
          className={
            index === focusedIndex ? "ring-2 ring-blue-500 outline-none" : ""
          }
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

export function LoadingIndicator({
  size = "md",
  label = "Loading",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <div
        className={`${sizes[size]} border-[var(--primary)] border-t-transparent rounded-full animate-spin`}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FormErrorMessage({
  id,
  error,
}: {
  id: string;
  error?: string;
}) {
  if (!error) return null;

  return (
    <p
      id={`${id}-error`}
      className="text-sm text-[var(--error)] mt-1"
      role="alert"
    >
      {error}
    </p>
  );
}

export function FormLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-[var(--on-surface)]"
    >
      {children}
      {required && (
        <span className="text-[var(--error)] ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function LiveRegion({
  message,
  politeness = "polite",
}: {
  message: string;
  politeness?: "polite" | "assertive";
}) {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    if (message !== currentMessage) {
      setCurrentMessage(message);
    }
  }, [message, currentMessage]);

  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      className="absolute w-px h-px p-0 overflow-hidden clip-[rect(0,0,0,0)] whitespace-nowrap border-0"
    >
      {currentMessage}
    </div>
  );
}

export default {
  useAriaLiveAnnouncer,
  AriaLiveRegion,
  SkipLink,
  FocusTrap,
  ColorContrastChecker,
  ScreenReaderOnly,
  VisibleOnly,
  KeyboardNavigableGrid,
  LoadingIndicator,
  FormErrorMessage,
  FormLabel,
  VisuallyHidden,
  LiveRegion,
};
