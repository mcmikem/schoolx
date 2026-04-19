"use client";

import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";

interface CollapsibleCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: number;
  className?: string;
}

export default function CollapsibleCard({
  title,
  icon,
  children,
  defaultExpanded = false,
  badge,
  className = "",
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`card overflow-hidden p-0 shadow-[0_18px_40px_rgba(15,23,42,0.06)] ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-[rgba(248,250,252,0.8)]"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#dde5ef] bg-white shadow-sm">
              <MaterialIcon icon={icon} className="text-sm" />
            </div>
          )}
          {!icon && (
            <div className="flex h-10 w-10 items-center justify-center">
              <OwlMascot size={36} premium />
            </div>
          )}
          <span className="font-medium">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <MaterialIcon
          icon={isExpanded ? "expand_less" : "expand_more"}
          className="text-surface-variant"
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 pt-0">{children}</div>
      </div>
    </div>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  priority?: "high" | "medium" | "low";
}

export function ResponsiveCard({
  children,
  className = "",
}: ResponsiveGridProps) {
  return <div className={`card p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] ${className}`}>{children}</div>;
}

export function MobileStack({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {children}
    </div>
  );
}

export function DesktopGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {children}
    </div>
  );
}

export function PriorityStats({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {primary}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {secondary}
      </div>
    </>
  );
}
