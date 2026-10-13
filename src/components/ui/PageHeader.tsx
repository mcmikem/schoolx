"use client";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * @deprecated The "premium" treatment (pulsing status dot, "School command
   * center" eyebrow, oversized watermark icon) was decorative chrome that only
   * appeared on some pages, so it read as noise rather than a system. Both
   * variants now render the same plain header.
   */
  variant?: "standard" | "premium";
}

export function PageHeader({ title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading text-[var(--t1)] tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--t3)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 flex-wrap">{actions}</div>}
      {children}
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
