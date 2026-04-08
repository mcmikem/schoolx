"use client";
import MaterialIcon from "@/components/MaterialIcon";

interface HelpTip {
  icon?: string;
  text: string;
}

interface PageGuidanceProps {
  title: string;
  tips: HelpTip[];
  variant?: "default" | "warning" | "info";
}

export function PageGuidance({
  title,
  tips,
  variant = "default",
}: PageGuidanceProps) {
  const variantStyles = {
    default: "bg-blue-soft text-blue",
    warning: "bg-amber-soft text-amber",
    info: "bg-green-soft text-green",
  };

  const iconMap = {
    default: "help_outline",
    warning: "warning",
    info: "check_circle",
  };

  return (
    <div className="mb-4 p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg flex-shrink-0 ${variantStyles[variant]}`}
        >
          <MaterialIcon className="text-xl">{iconMap[variant]}</MaterialIcon>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--t1)] mb-2">
            {title}
          </div>
          <div className="text-xs text-[var(--t3)] space-y-1.5">
            {tips.map((tip, index) => (
              <p key={index} className="flex items-start gap-2">
                {tip.icon && (
                  <MaterialIcon className="text-base mt-0.5 flex-shrink-0">
                    {tip.icon}
                  </MaterialIcon>
                )}
                <span>{tip.text}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
