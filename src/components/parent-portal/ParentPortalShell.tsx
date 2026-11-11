"use client";

import Image from "next/image";
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
import type { ParentPortalChild } from "@/lib/parent-portal";

/**
 * Four destinations, named the way a parent talks about school.
 *
 * "Academics" and "Finance" are words from the staff side of the product.
 * A parent opens this app to answer four questions: how is my child, are
 * the fees okay, what is the school telling me, and how do I reach them.
 */
const PARENT_NAV = [
  { href: "/parent-portal", label: "Home", icon: "home" },
  { href: "/parent-portal/academics", label: "Progress", icon: "trending_up" },
  { href: "/parent-portal/fees", label: "Fees", icon: "payments" },
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

function ChildFace({ child, size = 40 }: { child: ParentPortalChild | null; size?: number }) {
  if (!child) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-[var(--t3)]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <MaterialIcon icon="child_care" size={Math.round(size * 0.55)} />
      </span>
    );
  }

  const photo = child.photo_url || child.avatar_url;
  if (photo) {
    return (
      <Image
        src={photo}
        alt=""
        width={size * 2}
        height={size * 2}
        unoptimized
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--primary-50)] text-[length:calc(var(--avatar-font))] font-semibold text-[var(--primary)]"
      style={{ width: size, height: size, ["--avatar-font" as string]: `${Math.round(size * 0.38)}px` }}
      aria-hidden="true"
    >
      {child.first_name?.[0]}
      {child.last_name?.[0]}
    </span>
  );
}

function ParentPortalShellContent({ children, pageTitle }: { children: React.ReactNode; pageTitle: string }) {
  const { user, school, signOut } = useAuth();
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
  const syncLabel = !isOnline
    ? "Offline"
    : isSyncing
      ? "Saving"
      : pendingCount
        ? `${pendingCount} waiting`
        : "Up to date";
  const syncTone = !isOnline
    ? "text-[var(--amber-ink)] bg-[var(--amber-soft)] border-[var(--amber)]/30"
    : "text-[var(--green-ink)] bg-[var(--green-soft)] border-[var(--green)]/25";

  const schoolName = school?.name || "Your school";
  const parentFirstName = user?.full_name?.trim().split(/\s+/)[0] || "there";
  const onHome = normalizedPath === "/parent-portal";

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--t1)] lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {school?.logo_url ? (
              <Image
                src={school.logo_url}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <SkoolMateLogo size="sm" showText={false} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-[var(--t1)]">{schoolName}</span>
            <span className="block text-[11px] text-[var(--t4)]">Parent account</span>
          </span>
        </div>

        {linkedChildren.length > 0 && (
          <div className="px-4 pb-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-container-low)] p-3">
              <p className="text-[11px] font-medium text-[var(--t4)]">
                {linkedChildren.length > 1 ? "You are following" : "Your child"}
              </p>
              {linkedChildren.length === 1 && selectedChild ? (
                <div className="mt-2 flex items-center gap-2.5">
                  <ChildFace child={selectedChild} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--t1)]">
                      {selectedChild.first_name} {selectedChild.last_name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--t3)]">{selectedChild.class_name}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <ChildSelector label="child" />
                </div>
              )}
            </div>
          </div>
        )}

        <nav aria-label="Parent portal" className="flex-1 space-y-1 px-3">
          {PARENT_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--surface-container-low)] font-semibold text-[var(--t1)]"
                    : "text-[var(--t3)] hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
                }`}
              >
                <MaterialIcon
                  icon={item.icon}
                  size={19}
                  className={active ? "text-[var(--primary)]" : "text-[var(--t4)]"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-[var(--t3)]">
              <MaterialIcon icon="person" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[var(--t1)]">
                {user?.full_name || "Parent account"}
              </span>
              <span className="block text-[11px] text-[var(--t4)]">Signed in</span>
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] text-[11.5px] font-medium text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)]"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <MaterialIcon icon={theme === "dark" ? "light_mode" : "dark_mode"} size={16} />
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] text-[11.5px] font-medium text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)]"
            >
              <MaterialIcon icon="logout" size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <Link
              href="/parent-portal"
              className="-ml-1 flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1"
              aria-label={`${schoolName} parent home`}
            >
              <ChildFace child={selectedChild} size={34} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold leading-tight text-[var(--t1)]">
                  {selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : schoolName}
                </span>
                <span className="block truncate text-[11px] leading-tight text-[var(--t4)]">
                  {selectedChild?.class_name || `Hello ${parentFirstName}`}
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={`mr-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${syncTone}`}
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
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)]"
              >
                <MaterialIcon icon={theme === "dark" ? "light_mode" : "dark_mode"} size={19} />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)]"
              >
                <MaterialIcon icon="logout" size={19} />
              </button>
            </div>
          </div>
          {linkedChildren.length > 1 && (
            <div className="pb-2.5">
              <ChildSelector label="child" />
            </div>
          )}
        </header>

        <OfflineModeBanner />
        <StorageWarning />

        <main
          id="main-content"
          aria-label={pageTitle}
          className={`mx-auto flex w-full max-w-[1200px] min-w-0 flex-1 flex-col pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-10 ${
            onHome ? "" : "pt-1"
          }`}
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Parent portal mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface)] px-2 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] shadow-[0_-4px_18px_rgba(16,24,40,0.06)] lg:hidden"
      >
        {PARENT_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10.5px] font-medium transition-colors ${
                active ? "text-[var(--primary)]" : "text-[var(--t4)]"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-[var(--primary-50)]" : "bg-transparent"
                }`}
              >
                <MaterialIcon icon={item.icon} size={20} />
              </span>
              <span className="truncate">{item.label}</span>
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
        <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--sh1)]">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-container-low)]">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border2)] border-t-[var(--primary)]" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--t1)]">Getting your child&apos;s details…</p>
            <p className="mt-1 text-[13px] text-[var(--t3)]">This only takes a moment.</p>
          </div>
        </div>
      </PageErrorBoundary>
    );
  }

  if (!isAuthorized) {
    return (
      <PageErrorBoundary>
        <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--sh1)]">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--amber-soft)]">
              <MaterialIcon icon="support_agent" size={22} className="text-[var(--amber-ink)]" />
            </span>
            <p className="mt-3 text-base font-semibold text-[var(--t1)]">We can&apos;t open your account yet</p>
            <p className="mt-1.5 text-[13px] leading-5 text-[var(--t3)]">
              Your phone number may not be linked to your child at school yet. Call or visit the school office and ask
              them to add it — then sign in again.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-600)]"
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
