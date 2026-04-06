"use client";
import MaterialIcon from "@/components/MaterialIcon";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  accentColor: string;
  loading?: boolean;
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
  trend,
}: StatCardProps) {
  const trendIcon =
    trend?.direction === "up"
      ? "trending_up"
      : trend?.direction === "down"
        ? "trending_down"
        : "trending_flat";
  const trendColor =
    trend?.direction === "up"
      ? "text-[var(--green)]"
      : trend?.direction === "down"
        ? "text-[var(--red)]"
        : "text-[var(--t4)]";

  return (
    <div className="stat-card">
      <div className={`stat-accent bg-${accentColor}`} />
      <div className="stat-inner">
        <div className="stat-meta">
          <div className="stat-label">{label}</div>
          <div
            className={`stat-icon-box bg-${accentColor}-soft text-${accentColor}`}
          >
            <MaterialIcon icon={icon} />
          </div>
        </div>
        <div className={`stat-val text-${accentColor}`}>
          {loading ? "..." : value}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 mt-1 text-[12px] font-medium ${trendColor}`}
          >
            <MaterialIcon icon={trendIcon} style={{ fontSize: 16 }} />
            <span>
              {trend.direction === "up"
                ? "↑"
                : trend.direction === "down"
                  ? "↓"
                  : "→"}{" "}
              {trend.value}%
            </span>
            <span className="text-[var(--t4)] ml-1">{trend.label}</span>
          </div>
        )}
        {subValue && !trend && (
          <div className="text-[12px] text-[var(--t3)] font-medium mt-1 uppercase tracking-wider">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}
