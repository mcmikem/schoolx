"use client";
import MaterialIcon from "@/components/MaterialIcon";

const ACCENT_STYLES: Record<string, { solid: string; soft: string }> = {
  navy: { solid: "var(--navy)", soft: "var(--navy-soft)" },
  green: { solid: "var(--green)", soft: "var(--green-soft)" },
  amber: { solid: "var(--amber)", soft: "var(--amber-soft)" },
  purple: { solid: "#7c3aed", soft: "#f3e8ff" },
};

// Accent shadow RGB for colored box-shadows
const ACCENT_SHADOW: Record<string, string> = {
  navy: "0,31,63",
  green: "13,148,136",
  amber: "180,83,9",
  purple: "124,58,237",
};

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
  const accent = ACCENT_STYLES[accentColor] || ACCENT_STYLES.navy;
  const shadowRgb = ACCENT_SHADOW[accentColor] || ACCENT_SHADOW.navy;

  const trendIcon =
    trend?.direction === "up"
      ? "trending_up"
      : trend?.direction === "down"
        ? "trending_down"
        : "trending_flat";

  // ── Premium variants (unchanged) ──────────────────────────────────────────
  if (isPremium) {
    const cardClass = `stat-card ${
      variant === "premium-teal"
        ? "card-gradient-teal animate-float-gentle"
        : variant === "premium-navy"
          ? "card-gradient-navy animate-float-gentle"
          : "card-gradient-amber animate-float-gentle"
    }`;
    return (
      <div className={`${cardClass} shadow-[0_22px_48px_rgba(15,23,42,0.07)]`}>
        <div className="stat-inner !p-6">
          <div className="stat-meta">
            <div className="stat-label !text-white/80">{label}</div>
            <div className="stat-icon-box bg-white/20 text-white">
              <MaterialIcon icon={icon} />
            </div>
          </div>
          <div className="stat-val !text-white">{loading ? "..." : value}</div>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-[12px] font-bold text-white/80">
              <MaterialIcon icon={trendIcon} style={{ fontSize: 16 }} />
              <span>
                {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
                {trend.value}%
              </span>
              <span className="text-white/60 ml-1">{trend.label}</span>
            </div>
          )}
          {subValue && !trend && (
            <div className="text-[12px] font-medium mt-2 uppercase tracking-wider text-white/80">
              {subValue}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Standard (redesigned — on-brand, not generic SaaS) ────────────────────
  return (
    <div
      className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex flex-col transition-all duration-200 cursor-default group hover:-translate-y-0.5 overflow-hidden"
      style={{
        boxShadow: `0 1px 4px rgba(15,23,42,0.06), 0 6px 18px rgba(${shadowRgb},0.07)`,
      }}
    >
      {/* Decorative radial glow behind icon — subtle brand wash */}
      <div
        className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-300"
        style={{ background: accent.solid }}
      />

      <div className="p-5 flex-1 flex flex-col relative z-[1]">
        {/* Icon badge (top-left, solid brand color) */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
            style={{
              background: accent.solid,
              color: "white",
              boxShadow: `0 4px 14px rgba(${shadowRgb},0.30)`,
            }}
          >
            <MaterialIcon icon={icon} style={{ fontSize: 22 }} />
          </div>

          {/* Trend badge (top-right) */}
          {trend && (
            <div
              className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-full ${
                trend.direction === "up"
                  ? "bg-[var(--green-soft)] text-[var(--green)]"
                  : trend.direction === "down"
                    ? "bg-[var(--red-soft)] text-[var(--red)]"
                    : "bg-[var(--navy-soft)] text-[var(--t3)]"
              }`}
            >
              <MaterialIcon icon={trendIcon} style={{ fontSize: 13 }} />
              {trend.value}%
            </div>
          )}
        </div>

        {/* Hero number */}
        <div
          className="text-[30px] sm:text-[32px] font-extrabold tracking-tight leading-none text-[var(--t1)]"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {loading ? (
            <span className="inline-block h-8 w-20 rounded-lg bg-[var(--border)] animate-pulse" />
          ) : (
            value
          )}
        </div>

        {/* Label — below number in accent color (not generic gray) */}
        <div
          className="text-[10px] font-bold uppercase tracking-[0.18em] mt-2"
          style={{ color: accent.solid, opacity: 0.75 }}
        >
          {label}
        </div>

        {/* Sub value */}
        {subValue && !loading && (
          <div className="text-[12px] font-medium mt-1.5 text-[var(--t3)]">{subValue}</div>
        )}

        {/* Trend sub-label */}
        {trend && !loading && (
          <div className="text-[11px] text-[var(--t4)] mt-1.5 font-medium">{trend.label}</div>
        )}
      </div>

      {/* Bottom accent gradient line */}
      <div
        className="h-[3px] flex-shrink-0"
        style={{
          background: `linear-gradient(to right, ${accent.solid}cc 0%, ${accent.solid}33 60%, transparent 100%)`,
        }}
      />
    </div>
  );
}
