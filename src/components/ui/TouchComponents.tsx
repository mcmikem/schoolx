"use client";

import { useState, useEffect, ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  loading?: boolean;
  "aria-label"?: string;
}

// Hook to detect touch device
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouch;
}

export function TouchButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  fullWidth = false,
  loading = false,
  className = "",
  disabled,
  "aria-label": ariaLabel,
  ...props
}: TouchButtonProps) {
  const isTouch = useIsTouchDevice();

  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary:
      "bg-[var(--primary)] text-white hover:opacity-90 focus:ring-[var(--primary)]",
    secondary:
      "bg-[var(--surface-container)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] focus:ring-[var(--primary)]",
    ghost:
      "bg-transparent text-[var(--on-surface)] hover:bg-[var(--surface-container)] focus:ring-[var(--primary)]",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    outline:
      "bg-transparent border-2 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 focus:ring-[var(--primary)]",
  };

  const sizeClasses = {
    sm: isTouch
      ? "min-h-[36px] px-3 py-2 text-sm gap-1.5"
      : "px-3 py-1.5 text-sm gap-1.5",
    md: isTouch
      ? "min-h-[44px] px-4 py-2.5 text-base gap-2"
      : "px-4 py-2 text-base gap-2",
    lg: isTouch
      ? "min-h-[52px] px-6 py-3 text-lg gap-2.5"
      : "px-6 py-2.5 text-lg gap-2.5",
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === "left" && icon}
          {children}
          {icon && iconPosition === "right" && icon}
        </>
      )}
    </button>
  );
}

// Input component with better touch support
interface TouchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  "aria-describedby"?: string;
}

export function TouchInput({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: TouchInputProps) {
  const isTouch = useIsTouchDevice();
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--on-surface)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-xl border bg-[var(--surface)] px-4 py-3 text-[var(--on-surface)] transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20",
          isTouch && "min-h-[44px] py-3",
          error
            ? "border-red-500 focus:border-red-500"
            : "border-[var(--border)] focus:border-[var(--primary)]",
          className,
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(" ") || undefined
        }
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-[var(--t3)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
