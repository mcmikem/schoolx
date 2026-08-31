"use client";

import { isValidElement, useId } from "react";
import { RingSpinner } from "@/components/loaders";
export { Modal, ModalFooter } from "./Modal";

// Fixed duplicate interface line

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

function extractButtonLabel(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const text = extractButtonLabel(child);
      if (text) return text;
    }
  }
  if (isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    return extractButtonLabel(props.children);
  }
  return "";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  title,
  fullWidth = false,
  ...props
}: ButtonProps & { fullWidth?: boolean }) {
  const baseClass =
    "font-semibold rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

  const variants = {
    primary: "bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 shadow-sm",
    secondary: "bg-[var(--surface-container)] text-[var(--on-surface)] hover:opacity-80",
    ghost: "bg-transparent text-[var(--on-surface)] hover:bg-[var(--surface-container)]",
    outline:
      "bg-transparent border border-[var(--border)] text-[var(--on-surface)] hover:bg-[var(--surface-container)]",
    danger: "bg-[var(--error)] text-white hover:opacity-90",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base",
  };

  return (
    <button
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      disabled={disabled || loading}
      title={title || extractButtonLabel(children) || undefined}
      {...props}
    >
      {loading ? <RingSpinner size={16} /> : icon ? icon : null}
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

export function Input({ label, error, className = "", endAdornment, id: idProp, required, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const paddingRight = endAdornment ? "pr-12" : "";
  const fieldClass = `w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${error ? "border-[var(--error)]" : ""} ${paddingRight} ${className} text-base`;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[var(--on-surface)]">
          {label}
        </label>
      )}
      {endAdornment ? (
        <div className="relative">
          <input
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            aria-required={required ? true : undefined}
            required={required}
            className={fieldClass}
            {...props}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <div className="pointer-events-auto">{endAdornment}</div>
          </div>
        </div>
      ) : (
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-required={required ? true : undefined}
          required={required}
          className={fieldClass}
          {...props}
        />
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = "", error, required, ...props }: SelectProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--on-surface)]">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={required ? true : undefined}
        required={required}
        className={`w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${className} text-base`}
        {...props}
      >
        <option value="" disabled hidden>
          Select option
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id: idProp, required, ...props }: TextareaProps) {
  const generatedId = useId();
  const textareaId = idProp ?? generatedId;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-[var(--on-surface)]">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        aria-required={required ? true : undefined}
        required={required}
        className={`w-full min-h-[140px] resize-vertical px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${error ? "border-[var(--error)]" : ""} ${className} text-base`}
        {...props}
      />
      {error && (
        <p id={`${textareaId}-error`} role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
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
      <img src={src} alt={name} loading="lazy" className={`${sizes[size]} rounded-full object-cover`} />
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
