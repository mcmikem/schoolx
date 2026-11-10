"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useSyncStatus } from "@/lib/useSyncStatus";
import MaterialIcon from "@/components/MaterialIcon";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { OfflineModeBanner } from "@/components/OfflineModeBanner";
import { StorageWarning } from "@/components/StorageWarning";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { ChildSelector } from "@/components/parent-portal/ChildSelector";
import { useParentPortal } from "@/components/parent-portal/ParentPortalProvider";

const PARENT_NAV = [
  { href: "/parent-portal", label: "Dashboard", icon: "home" },
  { href: "/parent-portal/academics", label: "Academics", icon: "school" },
  { href: "/parent-portal/fees", label: "Finance", icon: "account_balance" },
  { href: "/parent-portal/messages", label: "Messages", icon: "chat_bubble" },
] as const;
const NAV_ACTIVE_ROUTES: Record<string, string[]> = {
  "/parent-portal": ["/parent-portal"],
  "/parent-portal/academics": [
    "/parent-portal/academics",
    "/parent-portal/results",
    "/parent-portal/homework",
    "/parent-portal/attendance",
    "/parent-portal/timetable",
    "/parent-portal/events",
  ],
  "/parent-portal/fees": ["/parent-portal/fees", "/parent-portal/canteen"],
  "/parent-portal/messages": ["/parent-portal/messages", "/parent-portal/notices"],
};

function ParentPortalShellContent({ children, pageTitle }: { children: React.ReactNode; pageTitle: string }) {
  const { user, signOut } = useAuth();
  const { children: linkedChildren, selectedChild } = useParentPortal();
  const { theme, toggleTheme } = useTheme();
  const { isOnline, isSyncing, pendingCount } = useSyncStatus();
  const pathname = usePathname() || "/parent-portal";
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isActive = (href: string) =>
    (NAV_ACTIVE_ROUTES[href] || [href]).some((route) =>
      route === "/parent-portal"
        ? normalizedPath === route
        : normalizedPath === route || normalizedPath.startsWith(`${route}/`),
    );
  const syncLabel = !isOnline ? "Offline" : isSyncing ? "Syncing" : pendingCount ? `${pendingCount} waiting` : "Synced";
  const syncTone = !isOnline
    ? "text-[var(--amber-ink)] bg-[var(--amber-soft)] border-[var(--amber)]/30"
    : "text-[var(--green-ink)] bg-[var(--green-soft)] border-[var(--green)]/25";

  return (
    <div className="min-h-dvh bg-[var(--surface-container-low)] text-[var(--t1)] lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-20 items-center border-b border-[var(--border)] px-6">
          <SkoolMateLogo size="sm" showText={false} />
        </div>
        <nav aria-label="Parent portal" className="flex-1 space-y-1 px-4 py-5">
          {PARENT_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[var(--primary-50)] text-[var(--primary)]"
                    : "text-[var(--t3)] hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
                }`}
              >
                <MaterialIcon icon={item.icon} size={21} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-4">
          <div className="mb-3 flex min-w-0 items-center gap-3 px-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--t3)]">
              <MaterialIcon icon="account_circle" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{user?.full_name || "Parent account"}</span>
              <span className="block text-xs text-[var(--t3)]">Parent portal</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <MaterialIcon icon={theme === "dark" ? "light_mode" : "dark_mode"} size={18} />
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
            >
              <MaterialIcon icon="logout" size={18} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <SkoolMateLogo size="sm" showText={false} />
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${syncTone}`}
              role="status"
              aria-live="polite"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-[var(--green)]" : "bg-[var(--amber)]"}`} />
              {syncLabel}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--t2)]"
            >
              <MaterialIcon icon={theme === "dark" ? "light_mode" : "dark_mode"} size={19} />
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--t2)]"
            >
              <MaterialIcon icon="logout" size={19} />
            </button>
          </div>
        </header>

        <OfflineModeBanner />
        <StorageWarning />
        {selectedChild && normalizedPath !== "/parent-portal" && (
          <section
            aria-label="Current learner"
            className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:px-6 lg:px-8"
          >
            {linkedChildren.length > 1 ? (
              <div className="mx-auto flex max-w-[1440px] items-center gap-3">
                <span className="hidden shrink-0 text-xs font-semibold text-[var(--t3)] sm:block">Viewing learner</span>
                <ChildSelector label="learner" />
              </div>
            ) : (
              <p className="mx-auto flex max-w-[1440px] min-w-0 items-center gap-2 text-xs text-[var(--t3)]">
                <MaterialIcon icon="child_care" size={16} className="shrink-0 text-[var(--primary)]" />
                <span className="shrink-0">Viewing</span>
                <span className="truncate font-semibold text-[var(--t1)]">
                  {selectedChild.first_name} {selectedChild.last_name}
                </span>
                {selectedChild.class_name && <span className="truncate">· {selectedChild.class_name}</span>}
              </p>
            )}
          </section>
        )}
        <main
          id="main-content"
          aria-label={pageTitle}
          className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Parent portal mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface)] px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_18px_rgba(0,69,173,0.06)] lg:hidden"
      >
        {PARENT_NAV.map((item) => {
          const active = isActive(item.href);
          const shortLabel = item.label === "Dashboard" ? "Home" : item.label === "Academics" ? "Academic" : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-bold transition-colors ${
                active ? "text-[var(--primary)]" : "text-[var(--t3)] hover:bg-[var(--surface-container-low)]"
              }`}
            >
              <MaterialIcon icon={item.icon} size={21} />
              <span className="truncate">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function ParentPortalShell({ children, pageTitle }: { children: React.ReactNode; pageTitle: string }) {
  const { isAuthorized, isChecking } = useParentPortalGuard();

  if (isChecking) {
    return (
      <PageErrorBoundary>
        <div className="flex min-h-dvh items-center justify-center bg-[var(--surface-container-low)] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--sh2)]">
            <div className="text-sm font-semibold text-[var(--t1)]">Loading parent portal...</div>
            <div className="mt-2 text-xs text-[var(--t3)]">Checking your account access and child records.</div>
          </div>
        </div>
      </PageErrorBoundary>
    );
  }

  if (!isAuthorized) {
    return (
      <PageErrorBoundary>
        <div className="flex min-h-dvh items-center justify-center bg-[var(--surface-container-low)] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--sh2)]">
            <div className="text-base font-semibold text-[var(--t1)]">Parent portal access unavailable</div>
            <div className="mt-2 text-sm text-[var(--t3)]">
              Your account cannot open the parent portal right now. Please contact your school administrator.
            </div>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </PageErrorBoundary>
    );
  }

  return (
    <PageErrorBoundary>
      <ParentPortalShellContent pageTitle={pageTitle}>{children}</ParentPortalShellContent>
    </PageErrorBoundary>
  );
}
