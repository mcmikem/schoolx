"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import SkoolMateLogo from "@/components/SkoolMateLogo";

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
    <div className="relative mb-6 overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-container-low)] p-5 sm:p-7">
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {school?.logo_url ? (
            <Image
              src={school.logo_url}
              alt={school?.name || "School"}
              width={80}
              height={80}
              className="object-contain rounded-xl"
              unoptimized
            />
          ) : (
            <SkoolMateLogo size="xl" showText variant="default" />
          )}
          <div className="flex flex-col">
            <p className="text-xs font-semibold text-[var(--t1)]">
              {greeting}, {userName}
            </p>
            <p className="text-[11px] text-[var(--t3)]">{subtitle || school?.name}</p>
          </div>
        </div>
        {rightSection && <div className="hidden sm:block">{rightSection}</div>}
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
          <MaterialIcon icon="today" className="text-base" />
          <span className="font-semibold">{dateLabel}</span>
        </div>
        {bottomCenter}
        {bottomRight && <div className="ml-auto">{bottomRight}</div>}
      </div>
    </div>
  );
}
