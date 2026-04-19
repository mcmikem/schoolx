"use client";

import { useId } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClass =
    "font-semibold rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-2";

  const variants = {
    primary:
      "bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 shadow-sm",
    secondary:
      "bg-[var(--surface-container)] text-[var(--on-surface)] hover:opacity-80",
    ghost:
      "bg-transparent text-[var(--on-surface)] hover:bg-[var(--surface-container)]",
    danger: "bg-[var(--error)] text-white hover:opacity-90",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base",
  };

  return (
    <button
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Renders inside the field on the right (e.g. password visibility toggle). */
  endAdornment?: React.ReactNode;
}

export function Input({
  label,
  error,
  className = "",
  endAdornment,
  id: idProp,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const paddingRight = endAdornment ? "pr-12" : "";
  const fieldClass = `w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${error ? "border-[var(--error)]" : ""} ${paddingRight} ${className} text-base`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--on-surface)]"
        >
          {label}
        </label>
      )}
      {endAdornment ? (
        <div className="relative">
          <input id={inputId} className={fieldClass} {...props} />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <div className="pointer-events-auto">{endAdornment}</div>
          </div>
        </div>
      ) : (
        <input id={inputId} className={fieldClass} {...props} />
      )}
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  options,
  className = "",
  ...props
}: SelectProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--on-surface)]"
        >
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${className} text-base`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "info" | "default";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const variants = {
    success: "bg-[var(--green-soft)] text-[var(--green)]",
    warning: "bg-[var(--amber-soft)] text-[var(--amber)]",
    error: "bg-[var(--red-soft)] text-[var(--red)]",
    info: "bg-[var(--navy-soft)] text-[var(--navy)]",
    default: "bg-[var(--surface-container)] text-[var(--on-surface-variant)]",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ src, name, size = "md" }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Deterministic color from name
  const colors = [
    "bg-emerald-100 text-emerald-700",
    "bg-blue-100 text-blue-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-purple-100 text-purple-700",
    "bg-teal-100 text-teal-700",
    "bg-orange-100 text-orange-700",
    "bg-indigo-100 text-indigo-700",
  ];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} ${colors[colorIndex]} rounded-full inline-flex items-center justify-center font-semibold select-none`}
    >
      {initials}
    </div>
  );
}

export { Breadcrumbs } from "./Breadcrumbs";
export {
  useKeyboardShortcuts,
  DEFAULT_SHORTCUTS,
} from "@/lib/hooks/useKeyboardShortcuts";
export { useAutoSave, useFieldValidation } from "@/lib/hooks/useAutoSave";
export { TouchButton, TouchInput } from "./TouchComponents";
