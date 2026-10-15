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
