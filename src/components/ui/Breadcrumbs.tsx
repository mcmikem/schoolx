"use client";

import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav
      className={`flex items-center gap-1 text-sm ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <MaterialIcon
                icon="chevron_right"
                className="text-[var(--t3)] mx-1 text-lg"
              />
            )}
            {isLast ? (
              <span
                className="text-[var(--t2)] font-medium flex items-center gap-1"
                aria-current="page"
              >
                {item.icon && (
                  <MaterialIcon icon={item.icon} className="text-lg" />
                )}
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-[var(--t3)] hover:text-[var(--primary)] flex items-center gap-1 transition-colors"
              >
                {item.icon && (
                  <MaterialIcon icon={item.icon} className="text-lg" />
                )}
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--t3)] flex items-center gap-1">
                {item.icon && (
                  <MaterialIcon icon={item.icon} className="text-lg" />
                )}
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
