"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface SchoolHeroProps {
  school?: { name?: string; logo_url?: string | null } | null;
  greeting: string;
  userName: string;
  dateLabel: string;
  subtitle?: string;
  rightSection?: ReactNode;
  bottomCenter?: ReactNode;
  bottomRight?: ReactNode;
}

export default function SchoolHero({
  school,
  greeting,
  userName,
  dateLabel,
  subtitle,
  rightSection,
  bottomCenter,
  bottomRight,
}: SchoolHeroProps) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--sh1)]">
      <div className="relative z-10 flex items-center gap-4">
        {school?.logo_url ? (
          <Image
            src={school.logo_url}
            alt={school?.name || "School"}
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[var(--border)] flex-shrink-0"
            unoptimized
          />
        ) : (
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-[22px] font-bold text-[var(--on-primary)]"
            style={{ fontFamily: "'Sora', sans-serif" }}
            aria-hidden="true"
          >
            {(school?.name || "S").charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-[20px] font-bold text-[var(--t1)] tracking-tight truncate"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {greeting}, {userName}
          </p>
          <p className="text-[13px] text-[var(--t3)] mt-0.5 truncate">
            {subtitle || school?.name}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
        </div>
        {rightSection && <div className="hidden sm:block flex-shrink-0">{rightSection}</div>}
      </div>

      {(bottomCenter || bottomRight) && (
        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
            <MaterialIcon icon="today" className="text-base" />
            <span className="font-semibold">{dateLabel}</span>
          </div>
          {bottomCenter}
          {bottomRight && <div className="ml-auto">{bottomRight}</div>}
        </div>
      )}
    </div>
  );
}
