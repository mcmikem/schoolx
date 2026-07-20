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
    <div className="relative mb-6 overflow-hidden rounded-[32px] border border-[#d6e4e8] bg-[linear-gradient(150deg,#eff7f5_0%,#eaf2f6_44%,#f8fbff_100%)] p-5 sm:p-7">
      <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[#b7dfd8]/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-[#d8e9fb]/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-20 w-60 -translate-x-1/2 rounded-full bg-[#c8dce8]/20 blur-2xl" />

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
            <p className="text-xs font-semibold text-[#17325f]">
              {greeting}, {userName}
            </p>
            <p className="text-[11px] text-[#42638d]">{subtitle || school?.name}</p>
          </div>
        </div>
        {rightSection && <div className="hidden sm:block">{rightSection}</div>}
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-[#c8dce8]/40 pt-4">
        <div className="flex items-center gap-2 text-xs text-[#42638d]">
          <MaterialIcon icon="today" className="text-base" />
          <span className="font-semibold">{dateLabel}</span>
        </div>
        {bottomCenter}
        {bottomRight && <div className="ml-auto">{bottomRight}</div>}
      </div>
    </div>
  );
}
