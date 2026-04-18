"use client";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  variant?: "standard" | "premium";
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  variant = "standard",
}: PageHeaderProps) {
  if (variant === "premium") {
    return (
      <div className="relative overflow-hidden rounded-[var(--r2)] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(240,247,255,0.98)_54%,rgba(236,253,245,0.92)_100%)] p-5 sm:p-6 mb-8 shadow-[var(--sh2)] motif-kente-border">
        <div className="absolute inset-0 pointer-events-none opacity-80 bg-[radial-gradient(circle_at_top_right,rgba(0,86,210,0.10),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(13,148,136,0.10),transparent_28%)]" />
        <div className="absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none">
          <span className="material-symbols-outlined text-[110px]">dashboard</span>
        </div>
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)] animate-pulse" />
              <span className="text-[11px] font-extrabold text-[var(--navy)] uppercase tracking-[0.28em]">
                School command center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading text-[var(--t1)] tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm sm:text-[15px] font-medium text-[var(--t3)] mt-2 max-w-3xl">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="relative flex flex-wrap items-center gap-2.5 bg-white/60 p-2 rounded-[18px] backdrop-blur-md border border-white/70 shadow-[0_8px_24px_rgba(0,31,63,0.08)]">
              {actions}
            </div>
          )}
        </div>
        {children && <div className="relative mt-5">{children}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--t1)] font-['Sora'] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[var(--t3)] mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
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

export function PageSection({
  title,
  description,
  children,
  className = "",
}: PageSectionProps) {
  return (
    <div className={className}>
      {title && (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[var(--t1)]">{title}</h2>
          {description && (
            <p className="text-sm text-[var(--t3)] mt-0.5">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
