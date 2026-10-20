# Shared UI components

Framework: Next.js App Router, React client components, Tailwind CSS, custom CSS tokens. Shared UI is implemented in-house.

## `src/components/ui/index.tsx`

```tsx
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
  placeholder?: string;
}

export function Select({
  label,
  options,
  className = "",
  error,
  required,
  placeholder = "Select option",
  ...props
}: SelectProps) {
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
        {!options.some((option) => option.value === "") && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
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
        className={`w-full min-h-[100px] resize-vertical px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${error ? "border-[var(--error)]" : ""} ${className} text-base`}
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
```

## `src/components/ui/Card.tsx`

```tsx
"use client";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", onClick, ...rest }: CardProps) {
  return (
    <div {...rest} className={`card ${onClick ? "cursor-pointer" : ""} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-title ${className}`}>{children}</div>;
}

export function CardSubtitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-sub ${className}`}>{children}</div>;
}
```

## `src/components/ui/PageHeader.tsx`

```tsx
"use client";

import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Branded treatment: Kente motif edge plus the school's own logo as a
   * low-opacity watermark. This is the ownership/branding cue, so it is kept.
   * Pass it on any page where the school should feel like its own place.
   */
  variant?: "standard" | "premium";
}

export function PageHeader({ title, subtitle, actions, children, variant = "standard" }: PageHeaderProps) {
  const { school } = useAuth();

  if (variant === "premium") {
    return (
      <div className="relative overflow-hidden rounded-[var(--r2)] border border-[var(--border)] bg-white p-5 sm:p-6 mb-8 shadow-[var(--sh2)] motif-kente-border">
        {/* School logo watermark — the ownership cue. Mirrors HeadmasterDashboard. */}
        {school?.logo_url && (
          <Image
            src={school.logo_url}
            alt=""
            aria-hidden="true"
            width={224}
            height={224}
            className="pointer-events-none absolute -right-10 -bottom-12 h-56 w-56 object-contain opacity-[0.07] select-none"
            unoptimized
          />
        )}
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-heading text-[var(--t1)] tracking-tight leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm sm:text-[15px] font-medium text-[var(--t3)] mt-2 max-w-3xl">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex max-w-full flex-wrap items-center gap-2.5 [&_button]:min-h-11 [&_a]:min-h-11">
              {actions}
            </div>
          )}
        </div>
        {children && <div className="relative mt-5 [&_a]:min-h-11 [&_button]:min-h-11">{children}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 mb-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-heading text-[var(--t1)] tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--t3)] mt-2 max-w-3xl leading-relaxed break-words">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex max-w-full flex-wrap items-center gap-2 [&_button]:min-h-11 [&_a]:min-h-11">{actions}</div>
      )}
      {children && <div className="w-full min-w-0">{children}</div>}
    </div>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function PageSection({ title, description, children, className = "" }: PageSectionProps) {
  return (
    <div className={className}>
      {title && (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[var(--t1)]">{title}</h2>
          {description && <p className="text-sm text-[var(--t3)] mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
```

## `src/components/ui/Modal.tsx`

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import MaterialIcon from "@/components/MaterialIcon";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showClose?: boolean;
  className?: string;
  /** Rendered in the header, before the close button (autosave state, badges). */
  headerAction?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showClose = true,
  className = "",
  headerAction,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw] max-h-[95vh]",
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onCloseRef.current();
      return;
    }

    if (e.key === "Tab" && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);

      setTimeout(() => {
        const focusable = modalRef.current?.querySelector("button, input, select, textarea") as HTMLElement;
        focusable?.focus();
      }, 50);
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        className={cn(
          "relative w-full bg-[var(--surface)] shadow-2xl border border-[var(--border)] overflow-hidden",
          "rounded-2xl max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] my-auto",
          "sm:mx-auto",
          sizes[size],
          "animate-slideUpBottomSheet sm:animate-none",
          className,
        )}
      >
        {(title || showClose || headerAction) && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border)]">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-[var(--t1)] font-['Sora']">
                {title}
              </h2>
            )}
            <div className="flex items-center gap-3 ml-auto">
              {headerAction}
              {showClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-[var(--surface-container)] transition-colors"
                  aria-label="Close modal"
                >
                  <MaterialIcon icon="close" className="text-lg text-[var(--t3)]" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="p-6 max-h-[calc(85vh-120px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return (
    <div className={cn("flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]", className)}>
      {children}
    </div>
  );
}
```

## `src/components/ui/Breadcrumbs.tsx`

```tsx
"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav
      className={`flex items-center gap-1 text-sm ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <MaterialIcon
                icon="chevron_right"
                className="text-[var(--t3)] mx-1 text-lg"
              />
            )}
            {isLast ? (
              <span
                className="text-[var(--t2)] font-medium flex items-center gap-1"
                aria-current="page"
              >
                {item.icon && (
                  <MaterialIcon icon={item.icon} className="text-lg" />
                )}
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-[var(--t3)] hover:text-[var(--primary)] flex items-center gap-1 transition-colors"
              >
                {item.icon && (
                  <MaterialIcon icon={item.icon} className="text-lg" />
                )}
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--t3)] flex items-center gap-1">
                {item.icon && (
                  <MaterialIcon icon={item.icon} className="text-lg" />
                )}
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
```
