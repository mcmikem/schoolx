"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { NavGroup, sortNavGroupsByPriority } from "@/lib/navigation";
import { readUserScoped, writeUserScoped } from "@/lib/user-scoped-storage";
import { cn } from "@/lib/utils";

interface CollapsibleSidebarProps {
  groups: readonly NavGroup[];
  onNavigate?: () => void;
  compact?: boolean;
  /**
   * Auth user id. "Continue where you left off" is namespaced to this: the
   * recent list used to sit in one global key, so on a shared tablet the next
   * person to sign in was shown the previous person's pages. Undefined during
   * the first render (auth still resolving) simply yields an empty list rather
   * than leaking the previous account's.
   */
  userId?: string | null;
}

export default function CollapsibleSidebar({ groups, onNavigate, compact = false, userId }: CollapsibleSidebarProps) {
  const pathname = usePathname();
  const path = pathname ?? "";
  const [query, setQuery] = useState("");
  const [recentPages, setRecentPages] = useState<Array<{ href: string; label: string; icon: string }>>([]);

  const sortedGroups = useMemo(() => sortNavGroupsByPriority(groups), [groups]);

  // Only the user's own taps are held in state. Whether a group defaults to
  // open is derived during render instead.
  //
  // This state used to hold every group's resolved value, recomputed in an
  // effect keyed on `groups` and `path`. SidebarShell builds `groups` with
  // `.map().filter()`, so the prop was a fresh array on every render: any
  // re-render re-ran the effect and reset every group. Tapping a title expanded
  // it and then snapped it straight back — depending on whether a re-render
  // happened to land after the tap, which is why it only happened sometimes.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  const groupLabels = sortedGroups.map((group) => group.label).join("|");

  // Forget overrides for groups that no longer exist (role change, feature
  // gating). Returns `prev` untouched when there is nothing to prune, so this
  // cannot loop.
  useEffect(() => {
    setOpenOverrides((prev) => {
      const present = new Set(sortedGroups.map((group) => group.label));
      const kept = Object.entries(prev).filter(([label]) => present.has(label));
      return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept);
    });
    // groupLabels is a primitive, so this keys on the group *set* rather than
    // on the array identity the parent hands down each render.
  }, [groupLabels]);

  const isGroupOpen = (group: NavGroup) => {
    const hasActive = group.items.some((item) =>
      item.href === "/dashboard" ? path === "/dashboard" : path === item.href || path.startsWith(item.href + "/"),
    );
    return openOverrides[group.label] ?? (hasActive || group.defaultOpen || false);
  };

  const toggleGroup = (group: NavGroup) => {
    setOpenOverrides((prev) => ({ ...prev, [group.label]: !isGroupOpen(group) }));
  };

  useEffect(() => {
    setRecentPages(readUserScoped<Array<{ href: string; label: string; icon: string }>>("skoolmate_recent_pages", userId) ?? []);
  }, [userId]);

  const normalizedQuery = query.trim().toLowerCase();
  const allowedHrefs = new Set(sortedGroups.flatMap((group) => group.items.map((item) => item.href)));
  const visibleRecentPages = recentPages.filter((item) => allowedHrefs.has(item.href));

  const filteredGroups = normalizedQuery
    ? sortedGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              item.label.toLowerCase().includes(normalizedQuery) || group.label.toLowerCase().includes(normalizedQuery),
          ),
        }))
        .filter((group) => group.items.length > 0)
    : sortedGroups;

  // Find the single most-specific active href across ALL groups so that
  // e.g. /dashboard/analytics/dna doesn't also light up /dashboard and /dashboard/analytics
  // Special case: /dashboard must match exactly (never via startsWith) to avoid
  // lighting up on every dashboard sub-page.
  const activeHref =
    sortedGroups
      .flatMap((g) => g.items)
      .filter((item) =>
        item.href === "/dashboard" ? path === "/dashboard" : path === item.href || path.startsWith(item.href + "/"),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  const trackRecentPage = (href: string, label: string, icon: string) => {
    setRecentPages((prev) => {
      const updated = [{ href, label, icon }, ...prev.filter((p) => p.href !== href)].slice(0, 4);
      writeUserScoped("skoolmate_recent_pages", userId, updated);
      return updated;
    });
  };

  if (compact) {
    return (
      <nav className="sidebar-nav overflow-y-auto flex-1 px-2 py-3" role="navigation" aria-label="Main navigation">
        <div className="space-y-2">
          {sortedGroups.map((group) => {
            const groupIcon = group.icon || group.items[0]?.icon || "dashboard";
            const groupHref = group.items[0]?.href || "/dashboard";
            const hasActive = group.items.some((item) => item.href === activeHref);

            return (
              <Link
                key={group.label}
                href={groupHref}
                title={group.label}
                onClick={() => {
                  const firstItem = group.items[0];
                  if (firstItem) {
                    trackRecentPage(firstItem.href, firstItem.label, firstItem.icon);
                  }
                  onNavigate?.();
                }}
                className={cn(
                  "mx-auto flex h-11 w-11 items-center justify-center rounded-xl border transition-all",
                  hasActive
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_10px_20px_rgba(0,92,230,0.18)]"
                    : "border-[var(--border)] bg-white text-[var(--t3)] hover:bg-[var(--surface-container-low)] hover:text-[var(--t2)]",
                )}
                aria-label={group.label}
                aria-current={hasActive ? "page" : undefined}
              >
                <MaterialIcon icon={groupIcon} className="text-[18px]" />
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="sidebar-nav overflow-y-auto flex-1 px-2 py-3" role="navigation" aria-label="Main navigation">
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 bg-white border border-[var(--border)] focus-within:border-[var(--primary)]/40 focus-within:ring-2 focus-within:ring-[var(--primary)]/10 rounded-[16px] px-3 py-2.5 transition-all shadow-[var(--sh1)]">
          <span className="material-symbols-outlined text-[16px] text-[var(--t4)]">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find page..."
            className="w-full bg-transparent border-none outline-none text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)]"
            aria-label="Search navigation pages"
          />
        </div>
      </div>

      {visibleRecentPages.length > 0 && !normalizedQuery && (
        <div className="px-2 pb-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--t4)] mb-1.5">
            Continue where you left off
          </div>
          <div className="space-y-1">
            {visibleRecentPages.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={onNavigate}
                className="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-[var(--t2)] hover:bg-[var(--surface-container-low)] no-underline"
              >
                <MaterialIcon icon={item.icon} className="text-[15px] text-[var(--t3)]" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {filteredGroups.map((group) => {
          const isOpen = Boolean(normalizedQuery) || isGroupOpen(group);
          const hasActive = group.items.some((item) => item.href === activeHref);

          return (
            <div key={group.label} className="sidebar-group">
              <button
                onClick={() => toggleGroup(group)}
                title={group.label}
                className={cn(
                  "flex min-h-11 items-center w-full px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition-colors duration-150 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                  hasActive || isOpen
                    ? "text-[var(--primary)]"
                    : "text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--surface-container-low)]",
                )}
                aria-expanded={isOpen}
              >
                {group.icon && <MaterialIcon icon={group.icon} className="text-[16px] mr-2" />}
                <span className="flex-1 text-left">{group.label}</span>
                <span className="sidebar-count-badge" aria-label={`${group.items.length} pages`}>
                  {group.items.length}
                </span>
                <span
                  className={cn(
                    "material-symbols-outlined text-[16px] transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                >
                  expand_more
                </span>
              </button>

              {isOpen && (
                <div className="mt-1 ml-2 space-y-1 border-l border-[var(--border)] pl-2.5">
                  {group.items.map((item) => {
                    const isActive = item.href === activeHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        onClick={() => {
                          trackRecentPage(item.href, item.label, item.icon);
                          onNavigate?.();
                        }}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all min-h-11 lg:min-h-[36px] group relative tap-effect",
                          isActive
                            ? "bg-[var(--primary)] text-white font-semibold shadow-[0_10px_20px_rgba(0,92,230,0.18)]"
                            : "text-[var(--t2)] hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]",
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {isActive && <div className="absolute left-0 w-1 h-4 bg-white rounded-r-full" />}
                        <MaterialIcon
                          icon={item.icon}
                          className={cn(
                            "text-[17px]",
                            isActive ? "text-white" : "text-[var(--t3)] group-hover:text-[var(--t2)]",
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                              item.badge === "New"
                                ? "bg-[var(--green-soft)] text-[var(--green)]"
                                : "bg-[var(--amber-soft)] text-[var(--amber)]",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredGroups.length === 0 && normalizedQuery && (
          <div className="px-3 py-3 text-[12px] text-[var(--t3)]">
            No results for “{query}”.
            <Link
              href="/dashboard"
              onClick={onNavigate}
              className="block mt-2 text-[var(--navy)] no-underline font-semibold"
            >
              Go to dashboard home
            </Link>
          </div>
        )}
        {filteredGroups.length === 0 && !normalizedQuery && (
          <div className="px-3 py-3 text-[12px] text-[var(--t3)]">Preparing your navigation...</div>
        )}
      </div>
    </nav>
  );
}
