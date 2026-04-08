"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

interface PinnedItem {
  href: string;
  label: string;
  icon: string;
}

const FAVORITES_KEY = "assemble_pinned_items";

const defaultPins: PinnedItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/students", label: "Students", icon: "group" },
  { href: "/dashboard/fees", label: "Fees", icon: "payments" },
];

const availableItems: PinnedItem[] = [
  { href: "/dashboard/attendance", label: "Attendance", icon: "how_to_reg" },
  { href: "/dashboard/grades", label: "Grades", icon: "menu_book" },
  { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
  { href: "/dashboard/staff", label: "Staff", icon: "person" },
  { href: "/dashboard/reports", label: "Reports", icon: "description" },
  { href: "/dashboard/messages", label: "Messages", icon: "chat" },
  { href: "/dashboard/notices", label: "Notices", icon: "campaign" },
  { href: "/dashboard/timetable", label: "Timetable", icon: "calendar_month" },
  { href: "/dashboard/payroll", label: "Payroll", icon: "payments" },
  {
    href: "/dashboard/budget",
    label: "Budget",
    icon: "account_balance_wallet",
  },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  { href: "/dashboard/health", label: "Health", icon: "medical_services" },
  { href: "/dashboard/discipline", label: "Discipline", icon: "warning" },
  { href: "/dashboard/uneb", label: "UNEB", icon: "workspace_premium" },
  { href: "/dashboard/promotion", label: "Promotion", icon: "trending_up" },
  { href: "/dashboard/homework", label: "Homework", icon: "assignment" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
];

export default function FavoritesBar() {
  const pathname = usePathname();
  const path = pathname ?? "";
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(defaultPins);

  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) {
      try {
        setPinnedItems(JSON.parse(saved));
      } catch {
        setPinnedItems(defaultPins);
      }
    }
  }, []);

  const savePins = useCallback((items: PinnedItem[]) => {
    setPinnedItems(items);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  }, []);

  const pinItem = (item: PinnedItem) => {
    if (pinnedItems.find((p) => p.href === item.href)) return;
    if (pinnedItems.length >= 6) {
      toast?.error(t("favorites.maxPinned"));
      return;
    }
    savePins([...pinnedItems, item]);
  };

  const unpinItem = (href: string) => {
    savePins(pinnedItems.filter((p) => p.href !== href));
  };

  return (
    <div className="relative flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {pinnedItems.slice(0, 5).map((item) => {
          const isActive =
            path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "fav-item flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition-colors duration-150",
                isActive
                  ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-[var(--sh1)]"
                  : "text-[var(--t2)] hover:bg-[var(--surface-container)]",
              )}
              title={item.label}
            >
              <MaterialIcon
                icon={item.icon}
                className={
                  isActive
                    ? "text-[var(--on-primary)]"
                    : "text-[var(--t3)]"
                }
                style={{ fontSize: 16 }}
              />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--t3)] shadow-[var(--sh1)] transition-colors",
          "hover:bg-[var(--bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/25",
        )}
        aria-expanded={isOpen}
        aria-label={t("favorites.managePins")}
        title={t("favorites.managePins")}
      >
        <MaterialIcon
          icon={isOpen ? "close" : "push_pin"}
          style={{ fontSize: 16 }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[100] max-h-[min(320px,70vh)] w-[280px] overflow-y-auto rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh3)]"
          role="dialog"
          aria-label={t("favorites.pinnedItems")}
        >
          <div className="border-b border-[var(--border)] px-3.5 py-3">
            <div className="text-[13px] font-semibold text-[var(--t1)]">
              {t("favorites.pinnedItems")}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--t3)]">
              {t("favorites.clickToPin")}
            </div>
          </div>

          <div className="p-2">
            {pinnedItems.map((item) => (
              <button
                key={item.href}
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-container)]"
                onClick={() => unpinItem(item.href)}
              >
                <MaterialIcon
                  icon={item.icon}
                  style={{ fontSize: 16, color: "var(--t3)" }}
                />
                <span className="flex-1 text-[13px] text-[var(--t1)]">
                  {item.label}
                </span>
                <MaterialIcon
                  icon="close"
                  style={{ fontSize: 14, color: "var(--t4)" }}
                />
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--border)] px-3.5 py-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--t3)]">
              {t("favorites.availableToPin")}
            </div>
            <div className="flex flex-wrap gap-1">
              {availableItems
                .filter(
                  (item) => !pinnedItems.find((p) => p.href === item.href),
                )
                .map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => pinItem(item)}
                    className="flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--t2)] transition-colors hover:bg-[var(--surface-container)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/25"
                  >
                    <MaterialIcon icon="add" style={{ fontSize: 12 }} />
                    {item.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
