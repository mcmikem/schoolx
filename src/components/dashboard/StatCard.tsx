"use client";
import MaterialIcon from "@/components/MaterialIcon";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  accentColor: string;
  loading?: boolean;
  variant?: "standard" | "compact" | "premium-teal" | "premium-navy" | "premium-amber";
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label: string;
  };
}

export default function StatCard({
  label,
  value,
  subValue,
  icon,
  accentColor,
  loading,
  variant = "standard",
  trend,
}: StatCardProps) {
  const isPremium = variant.startsWith("premium");
  
  const trendIcon =
    trend?.direction === "up"
      ? "trending_up"
      : trend?.direction === "down"
        ? "trending_down"
        : "trending_flat";
  
  const trendColor = isPremium 
    ? "text-white/80" 
    : trend?.direction === "up"
      ? "text-[var(--green)]"
      : trend?.direction === "down"
        ? "text-[var(--red)]"
        : "text-[var(--t4)]";

  const cardClass = `stat-card ${
    variant === "premium-teal" ? "card-gradient-teal animate-float-gentle" :
    variant === "premium-navy" ? "card-gradient-navy animate-float-gentle" :
    variant === "premium-amber" ? "card-gradient-amber animate-float-gentle" :
    ""
  }`;

  return (
    <div className={cardClass}>
      {!isPremium && <div className={`stat-accent bg-${accentColor}`} />}
      <div className={`stat-inner ${isPremium ? "!p-6" : ""}`}>
        <div className="stat-meta">
          <div className={`stat-label ${isPremium ? "!text-white/80" : ""}`}>{label}</div>
          <div
            className={`stat-icon-box ${
              isPremium 
                ? "bg-white/20 text-white" 
                : `bg-${accentColor}-soft text-${accentColor}`
            }`}
          >
            <MaterialIcon icon={icon} />
          </div>
        </div>
        <div className={`stat-val ${isPremium ? "!text-white" : `text-${accentColor}`}`}>
          {loading ? "..." : value}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 mt-2 text-[12px] font-bold ${trendColor}`}
          >
            <MaterialIcon icon={trendIcon} style={{ fontSize: 16 }} />
            <span>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.value}%
            </span>
            <span className={`${isPremium ? "text-white/60" : "text-[var(--t4)]"} ml-1`}>{trend.label}</span>
          </div>
        )}
        {subValue && !trend && (
          <div className={`text-[12px] font-medium mt-2 uppercase tracking-wider ${isPremium ? "text-white/80" : "text-[var(--t3)]"}`}>
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}
