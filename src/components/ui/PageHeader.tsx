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
      <div className="relative overflow-hidden bg-motif rounded-[var(--r2)] p-6 mb-8 border border-[var(--border)] shadow-sm motif-kente-border">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <span className="material-symbols-outlined text-[120px]">school</span>
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="w-2 h-2 rounded-full bg-[var(--navy)] animate-pulse" />
               <span className="text-[10px] font-extrabold text-[var(--navy)] uppercase tracking-widest">Universal Hub</span>
            </div>
            <h1 className="text-3xl font-heading text-[var(--t1)] tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm font-medium text-[var(--t3)] mt-1.5 opacity-80">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 bg-white/40 p-1.5 rounded-2xl backdrop-blur-sm border border-white/40">
              {actions}
            </div>
          )}
        </div>
        {children}
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
