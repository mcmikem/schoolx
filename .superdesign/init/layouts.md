# Shared application layouts

## Dashboard shell

## `src/app/dashboard/layout.tsx`

```tsx
"use client";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import ExpiredNotice from "@/components/dashboard/ExpiredNotice";
import TrialBanner from "@/components/dashboard/TrialBanner";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
const OnboardingFlow = dynamic(() => import("@/components/onboarding/OnboardingFlow"), {
  ssr: false,
  loading: () => null,
});
const PostOnboardingSetup = dynamic(() => import("@/components/onboarding/PostOnboardingSetup"), {
  ssr: false,
  loading: () => null,
});
const GoLiveGate = dynamic(() => import("@/components/GoLiveGate"), { ssr: false, loading: () => null });
import { useAccessControl, getPageTitle } from "@/components/dashboard/AccessControlGuard";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { MinimalLoadingScreen, TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { useSchoolColors } from "@/lib/useSchoolColors";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import MaterialIcon from "@/components/MaterialIcon";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
const OwlAssistant = dynamic(() => import("@/components/OwlAssistant"), { ssr: false });
// CommandPalette removed — GlobalSearch is now the single search system (see src/components/GlobalSearch.tsx)
const RoleBasedWalkthrough = dynamic(() => import("@/components/RoleBasedWalkthrough"), { ssr: false });
import { supabase } from "@/lib/supabase";

function hasCompletedSetupProgress(value: unknown): boolean {
  if (!value) return false;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const completed =
      typeof parsed === "object" && parsed !== null && "completed" in parsed
        ? (parsed as { completed?: unknown }).completed
        : null;
    return Array.isArray(completed) && completed.length > 0;
  } catch {
    return false;
  }
}

const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  students: { label: "Students", icon: "group" },
  attendance: { label: "Attendance", icon: "how_to_reg" },
  grades: { label: "Grades", icon: "grade" },
  fees: { label: "Fees", icon: "payments" },
  messages: { label: "Messages", icon: "sms" },
  reports: { label: "Reports", icon: "bar_chart" },
  staff: { label: "Staff", icon: "badge" },
  settings: { label: "Settings", icon: "settings" },
  discipline: { label: "Discipline", icon: "gavel" },
  analytics: { label: "Analytics", icon: "insights" },
  assets: { label: "Assets", icon: "inventory" },
  export: { label: "Export", icon: "file_download" },
  import: { label: "Import", icon: "file_upload" },
  audit: { label: "Audit", icon: "fact_check" },
  timetable: { label: "Timetable", icon: "calendar_today" },
  exams: { label: "Exams", icon: "quiz" },
  library: { label: "Library", icon: "menu_book" },
  transport: { label: "Transport", icon: "directions_bus" },
  dorm: { label: "Dorm", icon: "hotel" },
  health: { label: "Health", icon: "health_and_safety" },
  notices: { label: "Notices", icon: "campaign" },
  payroll: { label: "Payroll", icon: "account_balance_wallet" },
  cashbook: { label: "Cashbook", icon: "book" },
  budget: { label: "Budget", icon: "savings" },
  invoicing: { label: "Invoicing", icon: "receipt_long" },
  idcards: { label: "ID Cards", icon: "badge" },
};

function buildBreadcrumbs(pathname: string, pageTitle: string): { label: string; href?: string; icon?: string }[] {
  const items: { label: string; href?: string; icon?: string }[] = [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  ];
  if (!pathname || pathname === "/dashboard" || pathname === "/dashboard/") return items;
  const trimmed = pathname.replace(/^\/dashboard\/?/, "");
  if (!trimmed) return items;
  const parts = trimmed.split("/").filter(Boolean);
  const sectionKey = parts[0];
  const section = SECTION_LABELS[sectionKey];
  // Always link the section
  if (section) {
    const sectionHref = `/dashboard/${sectionKey}`;
    if (parts.length === 1) {
      items.push({ label: section.label, icon: section.icon });
      return items;
    }
    items.push({ label: section.label, href: sectionHref, icon: section.icon });
    // Build intermediate crumbs for nested routes like /students/[id]/admission-package
    let acc = sectionHref;
    for (let i = 1; i < parts.length - 1; i++) {
      acc += `/${parts[i]}`;
      const label = parts[i].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      // For UUID-like ids, show trimmed id
      const display = /^[0-9a-f-]{8,}$/i.test(label) ? `${label.slice(0, 8)}…` : label;
      items.push({ label: display, href: acc });
    }
    // Last segment is the page title (from getPageTitle) but fallback to prettified segment
    const lastLabel =
      pageTitle && pageTitle !== "Dashboard"
        ? pageTitle
        : parts[parts.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    items.push({ label: lastLabel });
  } else {
    // Fallback: build up to 3 levels generically
    let acc = "/dashboard";
    for (let i = 0; i < parts.length; i++) {
      acc += `/${parts[i]}`;
      const isLast = i === parts.length - 1;
      const label =
        isLast && pageTitle ? pageTitle : parts[i].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      items.push({ label, href: isLast ? undefined : acc });
    }
  }
  return items.slice(0, 6);
}

function SessionTimeoutWarning({ remainingTime, onExtend }: { remainingTime: number; onExtend: () => void }) {
  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session timeout warning"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
    >
      <div className="bg-[var(--surface)] rounded-[var(--r)] shadow-[var(--sh3)] p-6 max-w-sm w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <MaterialIcon icon="timer" className="text-yellow-600 text-2xl" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-[var(--t1)] mb-1">Session Expiring Soon</h2>
        <p className="text-sm text-[var(--t2)] mb-4">
          You will be signed out in <span className="font-bold text-[var(--error)]">{timeStr}</span> due to inactivity.
        </p>
        <button
          onClick={onExtend}
          className="w-full py-2.5 px-4 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Stay Signed In
        </button>
      </div>
    </div>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, school, loading, authInitialized, isDemo, isTrialExpired, signOut } = useAuth();
  useSchoolColors();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const hasRedirectedRef = useRef(false);
  const { close: closeSidebar } = useSidebar();

  useAccessControl();

  // Auth redirect guard — runs once after initial auth check resolves.
  // Uses a ref to prevent re-firing if loading/user state changes later
  // (e.g. token refresh, visibility change) which would cause redirect loops.
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!authInitialized || loading) return;
    if (user || isDemo) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled || hasRedirectedRef.current) return;

        // Session exists; avoid false login redirect during transient profile lag.
        if (session?.user?.id) return;

        hasRedirectedRef.current = true;
        router.replace("/login");
      } catch {
        if (cancelled || hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;
        router.replace("/login");
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authInitialized, loading, user, isDemo, router]);

  // Role-based redirect — parents and super_admin should not see dashboard.
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!authInitialized || loading || !user || isDemo) return;
    // The parent-portal guard bounces plan-limited parents here; exempt it so
    // they land on the access screen instead of orbiting /parent-portal → here.
    if (pathname?.startsWith("/dashboard/no-access")) return;

    if (user.role === "parent") {
      hasRedirectedRef.current = true;
      router.replace("/parent-portal");
      return;
    }

    if (user.role === "student") {
      hasRedirectedRef.current = true;
      router.replace("/student-portal");
      return;
    }

    if (user.role === "super_admin") {
      hasRedirectedRef.current = true;
      router.replace("/super-admin");
      return;
    }
  }, [authInitialized, loading, user, isDemo, router]);

  // Dynamic page title based on path
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "Dashboard";
    const title = lastSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    document.title = `${title} — SkoolMate OS`;
  }, [pathname]);

  const handleSignOut = async () => {
    sessionStorage.removeItem("lastDeniedPath");
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  // Close sidebar on every navigation (pathname change) to fix mobile stuck-open bug
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  const handleNavigate = () => {
    closeSidebar();
  };

  const pageTitle = getPageTitle(pathname || "/dashboard");
  const breadcrumbItems = buildBreadcrumbs(pathname || "/dashboard", pageTitle);
  const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPostSetup, setShowPostSetup] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const showInlineLoading = loading && !!user && !loadingTimedOut;
  const showStuckLoading = loading && !!user && loadingTimedOut;
  const isBillingPath = Boolean(
    currentPath.startsWith("/dashboard/settings") ||
      currentPath.startsWith("/dashboard/billing") ||
      currentPath.startsWith("/dashboard/pricing") ||
      currentPath.startsWith("/dashboard/fees") ||
      currentPath.startsWith("/dashboard/payment-plans"),
  );
  const isDashboardHome = currentPath === "/dashboard" || currentPath === "/dashboard/";

  const schoolData = (school as unknown as Record<string, unknown>) || null;
  const hasOperationalStudentData = Number(schoolData?.student_count || 0) > 0;
  const onboardingCompleted = Boolean(
    schoolData?.onboarding_completed ||
      schoolData?.onboarding_complete ||
      hasCompletedSetupProgress(schoolData?.setup_progress) ||
      hasOperationalStudentData,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const remember = localStorage.getItem("remember_session");
    setRememberSession(remember !== "false");
  }, []);

  // Session timeout – only active for real authenticated users (not demo)
  const { showWarning, remainingTime, extendSession } = useSessionTimeout({
    enabled: !!user && !isDemo && !loading && !rememberSession,
    onTimeout: async () => {
      await signOut();
    },
  });

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    const onboardingSessionKey =
      typeof window !== "undefined" && school?.id && user?.id ? `onboarding_shown_${school.id}|${user.id}` : null;

    if (school && !onboardingCompleted && user?.role === "school_admin" && !isBillingPath && isDashboardHome) {
      // Avoid reopening onboarding on every refresh/navigation in a session.
      const alreadyShown =
        typeof window !== "undefined" && onboardingSessionKey ? sessionStorage.getItem(onboardingSessionKey) : null;

      if (!alreadyShown && onboardingSessionKey) {
        sessionStorage.setItem(onboardingSessionKey, "1");
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
      setShowPostSetup(false);
    } else if (school && onboardingCompleted && user?.role === "school_admin" && isDashboardHome) {
      setShowOnboarding(false);
      if (typeof window !== "undefined" && onboardingSessionKey) {
        sessionStorage.removeItem(onboardingSessionKey);
      }

      // Only auto-open the post-setup panel once per browser session.
      const sessionKey = user?.id ? `post_setup_shown_${school.id}|${user.id}` : null;
      if (typeof window !== "undefined" && sessionKey && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        setShowPostSetup(true);
      }
    } else {
      setShowOnboarding(false);
      setShowPostSetup(false);
    }

    // Show go-live gate once per session for school_admins who completed onboarding
    if (school && onboardingCompleted && user?.role === "school_admin" && isDashboardHome) {
      const goLiveKey = user?.id ? `golive_shown_${school.id}|${user.id}` : null;
      if (
        typeof window !== "undefined" &&
        goLiveKey &&
        !sessionStorage.getItem(goLiveKey) &&
        !sessionStorage.getItem(`post_setup_shown_${school.id}|${user.id}`)
      ) {
        const checkGoLive = () => {
          if (goLiveKey && !sessionStorage.getItem(goLiveKey)) {
            setShowGoLive(true);
          }
        };
        const timer = setTimeout(checkGoLive, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentPath, isDashboardHome, onboardingCompleted, user?.role, user?.id, school, isBillingPath]);

  // Marketers bypass the school-oriented dashboard layout entirely.
  // They see their own dashboard without the school sidebar, TopBar,
  // breadcrumbs, or other school-specific chrome — similar to super_admin.
  if (user?.role === "marketer" && !isDemo) {
    return (
      <ErrorBoundary>
        <PageErrorBoundary>
          <Suspense
            fallback={
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900" />
              </div>
            }
          >
            {children}
          </Suspense>
        </PageErrorBoundary>
      </ErrorBoundary>
    );
  }

  // Show minimal loading bar while auth is initializing.
  if (!authInitialized) {
    return <MinimalLoadingScreen />;
  }

  // Auth initialized and no user — redirect guard above will fire.
  if (!user && !isDemo) {
    return null;
  }

  // Auth timed out or not resolved — redirect to login.
  if (!user && !isDemo) {
    return null; // redirect guard above will fire
  }

  return (
    <ErrorBoundary>
      {showInlineLoading && <TopLoadingBar />}
      {showStuckLoading && <StuckLoadingOverlay />}
      {showWarning && <SessionTimeoutWarning remainingTime={remainingTime} onExtend={extendSession} />}
      <OfflineIndicator />
      {isTrialExpired && <ExpiredNotice />}

      {showOnboarding && !isBillingPath && (
        <OnboardingFlow
          onComplete={() => {
            setShowOnboarding(false);
            setShowPostSetup(true);
          }}
          onDismiss={() => {
            setShowOnboarding(false);
            toast.info("Setup is hidden for this session. You can continue and complete it later.");
          }}
        />
      )}

      {showPostSetup && !showOnboarding && <PostOnboardingSetup onComplete={() => setShowPostSetup(false)} />}

      {showGoLive && !showOnboarding && !showPostSetup && (
        <GoLiveGate
          onDismiss={() => {
            setShowGoLive(false);
            if (typeof window !== "undefined" && school?.id && user?.id) {
              sessionStorage.setItem(`golive_shown_${school.id}|${user.id}`, "1");
            }
          }}
        />
      )}

      <div className="bg-motif dashboard-shell flex min-h-screen bg-[var(--bg)]">
        <SidebarShell onNavigate={handleNavigate} />
        <SidebarOverlay />

        <main id="main-content" className="main-content mobile-container flex-1 flex flex-col min-h-screen">
          <TopBar pageTitle={pageTitle} onSignOut={handleSignOut} />
          {breadcrumbItems.length > 1 && (
            <div className="dashboard-breadcrumbs px-4 sm:px-6 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
          )}
          <TrialBanner />
          <RoleBasedWalkthrough />
          <PageErrorBoundary>
            <Suspense
              fallback={
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900" />
                </div>
              }
            >
              {children}
            </Suspense>
          </PageErrorBoundary>
          <footer className="mt-auto px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] text-center">
            <p className="text-[11px] text-[var(--t4)]">
              Developed by <span className="font-semibold text-[var(--t3)]">IMAC Enterprises</span> · Powered by{" "}
              <span className="font-semibold text-[var(--t3)]">Omuto Foundation</span>
            </p>
          </footer>
        </main>
      </div>

      <MobileBottomNav />
      <OwlAssistant />
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}

function SidebarOverlay() {
  const { isOpen, close } = useSidebar();
  return (
    <button
      type="button"
      className={`sidebar-overlay ${isOpen ? "visible" : ""}`}
      aria-label="Close navigation"
      onClick={close}
    />
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
```

## `src/components/dashboard/SidebarShell.tsx`

```tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import ContactSupport from "@/components/ContactSupport";
import { MODULE_FOR_ROUTE, isRouteAllowed } from "@/components/dashboard/AccessControlGuard";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAcademic } from "@/lib/academic-context";
import { APP_NAME } from "@/lib/app-name";
import { useAuth } from "@/lib/auth-context";
import { canUseModule, DEFAULT_FEATURE_STAGE, type FeatureStage, type ModuleKey } from "@/lib/featureStages";
import { getNavigationForRoles } from "@/lib/navigation";
import { type RoleRouteOverrides, resolveRouteAccess, useRoleRouteOverrides } from "@/lib/role-access-overrides";
import { canAccess, type UserRole } from "@/lib/roles";
import { useSyncStatus } from "@/lib/useSyncStatus";

const ROUTE_TO_MODULE: Record<string, ModuleKey> = {};
for (const [route, mod] of Object.entries(MODULE_FOR_ROUTE)) {
  ROUTE_TO_MODULE[route] = mod;
}

function filterGroupsByFeatureStage(
  groups: readonly import("@/lib/navigation").NavGroup[],
  featureStage: FeatureStage | undefined,
  role: string | undefined,
  overrides: RoleRouteOverrides,
): import("@/lib/navigation").NavGroup[] {
  const stage = featureStage || DEFAULT_FEATURE_STAGE;
  const typedRole = role as UserRole | undefined;

  const canAccessRoute = (href: string): boolean => {
    if (!typedRole) return false;
    return resolveRouteAccess(typedRole, href, isRouteAllowed(typedRole, href), overrides);
  };

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const mod = ROUTE_TO_MODULE[item.href];
        const moduleAllowed = !mod || canUseModule(stage, mod);
        return moduleAllowed && canAccessRoute(item.href);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

function SyncStatus() {
  const { isOnline, pendingCount, isSyncing } = useSyncStatus();

  return (
    <div className="flex items-center gap-[7px] text-[11px] font-medium text-[var(--green)]">
      <div
        className="w-[7px] h-[7px] rounded-full"
        style={{
          background: isOnline ? "var(--green)" : "var(--red)",
          animation: isOnline && !isSyncing ? "blink 2.5s ease-in-out infinite" : "none",
        }}
      />
      {isOnline ? (isSyncing ? "Syncing..." : "System Active") : "Offline"}
      {pendingCount > 0 && (
        <span className="ml-auto text-[10px] text-[var(--amber)] font-[DM Mono]">{pendingCount} pending</span>
      )}
    </div>
  );
}

export default function SidebarShell({ onNavigate }: { onNavigate?: () => void }) {
  const { user, school } = useAuth();
  const { currentTerm } = useAcademic();
  const { isOpen, close } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const { overrides } = useRoleRouteOverrides(school?.id);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const showExpanded = !isDesktop ? isOpen : isHovered || isPinnedOpen;
  const isVisible = isDesktop || isOpen;
  const staffRole = user?.role as UserRole | undefined;
  const canInviteStaff = staffRole ? canAccess(staffRole, "staff") : false;
  // Everyone this person is, not just the one recorded as primary. Rural staff
  // routinely combine jobs — headmaster who also teaches, bursar who is also a
  // teacher — and a single-role sidebar left those people with no way to reach
  // half the app. MobileBottomNav already worked this way; this is what makes
  // the drawer agree with it. getNavigationForRoles de-duplicates by href and
  // keeps the primary role first so everyday items stay at the top.
  const roles = user?.roles?.length ? user.roles : staffRole ? [staffRole] : [];
  const rawGroups = roles.length ? getNavigationForRoles(roles) : [];
  const navigationGroups = filterGroupsByFeatureStage(
    rawGroups,
    school?.feature_stage as FeatureStage | undefined,
    user?.role,
    overrides,
  );

  const schoolName = school?.name || "My School";

  const sidebarClasses = [
    "sidebar bg-[var(--surface)] border-r border-[var(--border)] flex flex-col fixed top-0 left-0 bottom-0 z-40 shadow-[var(--sh2)]",
    isVisible ? "open" : "",
    isDesktop ? "desktop-rail" : "",
    isDesktop && showExpanded ? "rail-expanded" : "",
  ].join(" ");

  return (
    <aside
      id="dashboard-sidebar"
      className={sidebarClasses}
      aria-hidden={!isVisible}
      inert={!isVisible ? true : undefined}
      onMouseEnter={() => {
        if (isDesktop) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (isDesktop) setIsHovered(false);
      }}
    >
      <div className="sidebar-brand-header">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
            {school?.logo_url ? (
              <Image
                src={school.logo_url}
                alt={schoolName}
                width={28}
                height={28}
                className="w-7 h-7 rounded-lg object-cover"
              />
            ) : (
              <Image
                src="/SkoolMate logos/SchoolMate logo official.svg"
                alt={`${APP_NAME} Logo`}
                width={26}
                height={26}
                className="w-[26px] h-[26px] object-contain brightness-0 invert"
              />
            )}
          </div>
          {showExpanded && (
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-white tracking-[-.15px] leading-tight truncate">
                {schoolName}
              </div>
              <div className="text-[11px] text-white/55 mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--green)] flex-shrink-0" />
                {user?.role?.replace("_", " ") || "User"}
                {currentTerm ? ` · Term ${currentTerm}` : ""}
              </div>
            </div>
          )}
          {!isDesktop && (
            <button
              onClick={() => close()}
              className="h-11 w-11 tap-44 rounded-lg border-none bg-white/10 hover:bg-white/20 cursor-pointer items-center justify-center transition-colors flex"
              aria-label="Close sidebar"
            >
              <MaterialIcon icon="close" style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }} />
            </button>
          )}
          {isDesktop && (
            <button
              onClick={() => setIsPinnedOpen((prev) => !prev)}
              className="h-11 w-11 flex-shrink-0 rounded-lg border-none bg-white/10 hover:bg-white/20 cursor-pointer items-center justify-center transition-colors flex"
              aria-label={isPinnedOpen ? "Collapse sidebar" : "Pin sidebar open"}
              title={isPinnedOpen ? "Collapse" : "Pin open"}
            >
              <MaterialIcon
                icon={isPinnedOpen ? "left_panel_close" : "left_panel_open"}
                style={{ fontSize: 18, color: "rgba(255,255,255,0.85)" }}
              />
            </button>
          )}
        </div>
      </div>

      <CollapsibleSidebar groups={navigationGroups} onNavigate={onNavigate} compact={isDesktop && !showExpanded} />

      {showExpanded && canInviteStaff && (
        <div className="px-3 pb-1">
          <div className="rounded-2xl p-4 text-white bg-[#0e2a1e] shadow-[0_16px_32px_rgba(14,42,30,0.35)]">
            <p className="text-[13px] font-bold tracking-tight">Bring your team aboard</p>
            <p className="text-[11px] text-white/70 mt-1 leading-snug">
              Invite teachers and bursars to run the school together.
            </p>
            <Link
              href="/dashboard/staff"
              onClick={onNavigate}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-bold text-[var(--t1)] no-underline transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Invite staff
              <MaterialIcon icon="arrow_outward" style={{ fontSize: 14 }} />
            </Link>
          </div>
        </div>
      )}

      {showExpanded && (
        <div className="px-4 py-3 border-t border-[var(--border)] space-y-2">
          <SyncStatus />
          <ContactSupport variant="inline" label="Support" />
        </div>
      )}
    </aside>
  );
}
```

## `src/components/dashboard/TopBar.tsx`

```tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import GlobalSearch from "@/components/GlobalSearch";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications";
import { canOpenSettingsPage } from "@/lib/role-tab-access";
import { canAccess, type UserRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme-context";

type DashboardNotification = {
  id: string;
  type?: string;
  title: string;
  message: string;
  created_at: string;
  link?: string;
  read: boolean;
};

/** Exported for tests only — the nudge is pure, and the last attempt at
 *  changing it went unnoticed precisely because nothing pinned its behaviour. */
export const getNextStepForRoleForTest = getNextStepForRole;

function getNextStepForRole(
  path: string,
  role: UserRole | undefined,
): {
  label: string;
  href: string;
  icon: string;
} {
  if (!role) {
    return { label: "Back to dashboard", href: "/dashboard", icon: "dashboard" };
  }

  const candidates = [
    {
      allowed: canAccess(role, "students"),
      when: path === "/dashboard",
      step: { label: "Add students", href: "/dashboard/students", icon: "person_add" },
    },
    {
      allowed: canAccess(role, "attendance"),
      when: path.startsWith("/dashboard/students"),
      step: { label: "Take attendance", href: "/dashboard/attendance", icon: "how_to_reg" },
    },
    {
      allowed: canAccess(role, "fees"),
      when: path.startsWith("/dashboard/attendance"),
      step: { label: "Record fees", href: "/dashboard/fees", icon: "payments" },
    },
    {
      allowed: canAccess(role, "messages"),
      when: path.startsWith("/dashboard/fees"),
      step: { label: "Send reminders", href: "/dashboard/messages", icon: "sms" },
    },
    {
      allowed: canAccess(role, "messages"),
      when: path.startsWith("/dashboard/messages"),
      step: { label: "View notices", href: "/dashboard/notices", icon: "campaign" },
    },
  ] as const;

  for (const candidate of candidates) {
    if (candidate.when && candidate.allowed) {
      return candidate.step;
    }
  }

  if (canAccess(role, "attendance")) {
    return { label: "Take attendance", href: "/dashboard/attendance", icon: "how_to_reg" };
  }

  if (canAccess(role, "fees")) {
    return { label: "Record fees", href: "/dashboard/fees", icon: "payments" };
  }

  if (canAccess(role, "reports")) {
    return { label: "Open reports", href: "/dashboard/reports", icon: "bar_chart" };
  }

  if (path === "/dashboard") {
    return { label: "Back to dashboard", href: "/dashboard", icon: "dashboard" };
  }

  return { label: "Back to dashboard", href: "/dashboard", icon: "dashboard" };
}

function NotificationsPanel({
  open,
  onClose,
  notifications,
  onDismiss,
}: {
  open: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  onDismiss: (id: string) => void;
}) {
  const notifRouter = useRouter();
  if (!open) return null;

  return (
    <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-[20px] shadow-[var(--sh3)] min-w-[300px] max-w-[min(360px,calc(100vw-2rem))] z-50 overflow-hidden isolate">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--t1)]">Notifications</span>
        <span className="text-[11px] text-[var(--t3)]">{notifications.length} items</span>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {notifications.length === 0 && (
          <div className="px-4 py-[18px] text-[12px] text-[var(--t3)]">
            You are caught up. No urgent items right now.
          </div>
        )}
        {notifications.map((n) => {
          let icon = "notifications";
          let color = "var(--primary)";

          switch (n.type) {
            case "warning":
              icon = "warning";
              color = "var(--amber)";
              break;
            case "error":
              icon = "error";
              color = "var(--red)";
              break;
            case "success":
              icon = "check_circle";
              color = "var(--green)";
              break;
            case "payment":
              icon = "payments";
              color = "var(--green)";
              break;
            case "attendance":
              icon = "how_to_reg";
              color = "var(--amber)";
              break;
          }

          return (
            <div
              role="button"
              tabIndex={0}
              key={n.id}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!n.read) onDismiss(n.id);
                  if (n.link) notifRouter.push(n.link);
                }
              }}
              className={`w-full text-left flex gap-3 px-4 py-3.5 border-b border-[var(--border)] hover:bg-[var(--surface-container-low)] transition-colors cursor-pointer ${!n.read ? "bg-[var(--on-primary)]" : ""}`}
              onClick={() => {
                if (!n.read) onDismiss(n.id);
                if (n.link) notifRouter.push(n.link);
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20` }}
              >
                <MaterialIcon icon={icon} style={{ fontSize: 15, color: color }} />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer">
                <div className={`text-[12px] text-[var(--t1)] ${!n.read ? "font-bold" : "font-semibold"}`}>
                  {n.title}
                </div>
                <div className="text-[11px] text-[var(--t3)] mt-0.5 truncate">{n.message}</div>
                <div className="text-[10px] text-[var(--t4)] mt-1">
                  {new Date(n.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {!n.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(n.id);
                  }}
                  className="text-[var(--t4)] hover:text-[var(--t2)] transition-colors self-start mt-1"
                  aria-label="Mark as read"
                >
                  <MaterialIcon icon="check" style={{ fontSize: 14 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {notifications.length > 0 && (
        <button
          onClick={() => {
            notifications.forEach((n) => !n.read && onDismiss(n.id));
            onClose();
          }}
          className="w-full block px-4 py-[10px] text-center text-[12px] text-[var(--primary)] font-medium border-t border-[var(--border)] bg-[var(--surface-container-low)] transition-colors no-underline hover:bg-[var(--bg)]"
        >
          Mark all as read
        </button>
      )}
    </div>
  );
}

function UserMenu({ open, onClose, onSignOut }: { open: boolean; onClose: () => void; onSignOut: () => void }) {
  const { user, school } = useAuth();
  const schoolName = school?.name || "School";

  if (!open) return null;

  return (
    <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-[20px] shadow-[var(--sh3)] min-w-[240px] max-w-[min(300px,calc(100vw-2rem))] z-50 overflow-hidden isolate">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="text-[13px] font-bold text-[var(--t1)] truncate" title={schoolName}>
          {schoolName}
        </div>
        <div className="text-[11px] text-[var(--t3)] truncate">{user?.role?.replace("_", " ") || "User"}</div>
      </div>
      <Link
        href="/dashboard/learn"
        onClick={onClose}
        className="flex min-h-12 items-center gap-2 px-4 py-3 text-base text-[var(--t2)] no-underline hover:bg-[var(--bg)]"
      >
        <MaterialIcon icon="help_outline" size={20} />
        Help: learn step by step
      </Link>
      {canOpenSettingsPage(user?.role) && (
        <Link
          href="/dashboard/settings"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-[10px] text-[13px] text-[var(--t2)] no-underline hover:bg-[var(--bg)] transition-colors"
        >
          <MaterialIcon icon="settings" style={{ fontSize: 16 }} />
          Settings
        </Link>
      )}
      <div className="border-t border-[var(--border)]" />
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-2 px-4 py-[10px] text-[13px] text-[var(--red)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
      >
        <MaterialIcon icon="logout" style={{ fontSize: 16 }} />
        Sign Out
      </button>
    </div>
  );
}

export default function TopBar({ pageTitle, onSignOut }: { pageTitle: string; onSignOut: () => void }) {
  const router = useRouter();
  const { user, school } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentTerm } = useAcademic();
  const pathname = usePathname();
  const path = pathname ?? "";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const { isOpen, open: openSidebar, close: closeSidebar } = useSidebar();
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  const { notifications, unreadCount, markAsRead } = useNotifications();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    }

    function handleOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    function handlePointerDown(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifPanelRef.current && !notifPanelRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, [userMenuOpen, notifOpen]);

  const schoolName = school?.name || "My School";
  const nextStep = getNextStepForRole(path, user?.role as UserRole | undefined);
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header
      data-testid="dashboard-header"
      className="topbar h-[56px] flex items-center px-3 sm:px-5 lg:px-6 gap-2 sm:gap-3 sticky top-0 z-30 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)]"
    >
      {/* Hamburger — below desktop rail breakpoint (sidebar overlays under lg) */}
      <button
        onClick={() => {
          if (isOpen) closeSidebar();
          else openSidebar();
        }}
        className="bg-transparent border-none cursor-pointer p-1.5 h-11 w-11 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] transition-colors shrink-0 lg:hidden"
        aria-label="Toggle sidebar"
        aria-expanded={isOpen}
        aria-controls="dashboard-sidebar"
      >
        <MaterialIcon icon="menu" style={{ fontSize: 22, color: "var(--t1)" }} />
      </button>

      {/* School logo + Page title */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {school?.logo_url ? (
          <Image
            src={school.logo_url}
            alt={school?.name || "School"}
            width={28}
            height={28}
            className="w-7 h-7 rounded-lg object-cover shrink-0"
            priority
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {school?.name?.charAt(0) || "S"}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[15px] sm:text-[17px] font-bold text-[var(--t1)] tracking-[-.2px] truncate leading-tight">
            {pageTitle}
          </div>
          <div className="text-[11px] text-[var(--t3)] truncate leading-tight mt-0.5 hidden sm:block">
            {formattedDate}
            {currentTerm ? ` · Term ${currentTerm}` : ""}
          </div>
        </div>
      </div>

      {/* Search — desktop inline pill with kbd hint, mobile/tablet icon only to avoid crowding */}
      <div className="search-bar hidden lg:flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-2 text-[13px] text-[var(--t3)] min-w-[200px] xl:min-w-[280px] max-w-[320px] flex-1 cursor-text shadow-[var(--sh1)]">
        <GlobalSearch />
        <kbd className="search-kbd" aria-hidden="true" suppressHydrationWarning>
          {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>
      <button
        onClick={() => window.dispatchEvent(new Event("open-global-search"))}
        className="lg:hidden bg-transparent border-none cursor-pointer p-1.5 h-11 w-11 flex items-center justify-center rounded-lg text-[var(--t2)] hover:bg-[var(--surface-container-low)] transition-colors shrink-0"
        aria-label="Search"
      >
        <MaterialIcon icon="search" style={{ fontSize: 20 }} />
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Sync status indicator */}
        <div
          className="icon-btn-circle bg-[var(--surface)] shrink-0"
          title={isOnline ? "Connected" : "Offline"}
          role="status"
          aria-label={isOnline ? "Connected" : "Offline"}
        >
          <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
        </div>

        <div ref={notifPanelRef} className="notif-panel relative">
          <button
            onClick={() => {
              setNotifOpen((current) => !current);
              setUserMenuOpen(false);
            }}
            className="icon-btn-circle bg-[var(--surface)]"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
          >
            <MaterialIcon icon="notifications" style={{ fontSize: 18, color: "var(--t2)" }} />
            {unreadCount > 0 && (
              <div className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--red)] text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white shadow-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </div>
            )}
          </button>
          <NotificationsPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            notifications={notifications}
            onDismiss={(id) => markAsRead(id)}
          />
        </div>

        <button
          onClick={toggleTheme}
          className="icon-btn-circle hidden sm:flex bg-[var(--surface)]"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <MaterialIcon
            icon={theme === "dark" ? "light_mode" : "dark_mode"}
            style={{ fontSize: 18, color: "var(--t2)" }}
          />
        </button>

        <div ref={userMenuRef} className="relative">
          <button
            className="user-menu flex items-center gap-2 py-1 pr-2.5 pl-1 bg-[var(--surface)] border border-[var(--border)] rounded-full cursor-pointer transition-colors hover:bg-[var(--surface-container-low)] shadow-[var(--sh1)]"
            onClick={() => {
              setUserMenuOpen((current) => !current);
              setNotifOpen(false);
            }}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-[11px] font-bold text-[var(--on-primary)] shadow-[0_6px_14px_rgba(0,92,230,0.2)]">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            <span className="hidden sm:block min-w-0 text-left">
              <span className="block text-[13px] font-bold text-[var(--t1)] max-w-[80px] lg:max-w-[100px] truncate leading-tight">
                {user?.full_name?.split(" ")[0] || "User"}
              </span>
              {user?.email && (
                <span
                  className="hidden lg:block text-[11px] text-[var(--t3)] max-w-[180px] truncate leading-tight mt-px"
                  title={user.email}
                >
                  {user.email}
                </span>
              )}
            </span>
          </button>
          <UserMenu open={userMenuOpen} onClose={() => setUserMenuOpen(false)} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}
```

## `src/components/dashboard/MobileBottomNav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/lib/auth-context";
import { canAccessAny, type UserRole } from "@/lib/roles";

type QuickStep = {
  label: string;
  /** Compact label for the bottom bar. The full phrase ("Take Attendance") is
   *  far too wide for a nav slot on a 320px screen and gets truncated to an
   *  unreadable stub, so the bar uses a short noun instead. */
  navLabel: string;
  href: string;
  icon: string;
};

/**
 * The centre action in the mobile bar, declared per role.
 *
 * It used to be resolved by a capability priority — students, then attendance,
 * then fees. Every staff role except marketer can read `students`, so the
 * chain resolved the same step for six of seven roles: a bursar and a teacher
 * both got "Add Student" as their primary phone action, which is the daily task
 * of neither. Labels also promised an action while the href landed on a list
 * ("Add Student" → /dashboard/students), and the contextual swaps changed the
 * meaning of the same button depending on the current route.
 *
 * Two rules now hold: the label names the destination, and no entry duplicates
 * a destination the bar already carries (Home / Attend / Fees / More).
 *
 * The second rule used to be broken by the fallback: roles with no declared
 * entry all collapsed onto `DASHBOARD_FALLBACK` — { navLabel: "Home", href:
 * "/dashboard" } — so admin and school_admin saw the bar read "home, attend,
 * home, fees, more", with the second home lit whenever the first was. There is
 * no fallback any more; a role with no entry simply gets no centre slot.
 */
const ROLE_QUICK_ACTION: Record<string, QuickStep> = {
  // Attend already sits in the bar, so the next task is entering marks.
  teacher: { label: "Enter Marks", navLabel: "Marks", href: "/dashboard/grades", icon: "grade" },
  dean_of_studies: { label: "Academic Reports", navLabel: "Reports", href: "/dashboard/reports", icon: "description" },
  // Fees already sits in the bar; invoicing is the bursar's other daily task.
  bursar: { label: "Invoices", navLabel: "Invoices", href: "/dashboard/invoicing", icon: "description" },
  headmaster: { label: "Students", navLabel: "Students", href: "/dashboard/students", icon: "group" },
  secretary: { label: "Messages", navLabel: "Messages", href: "/dashboard/messages", icon: "chat" },
  dorm_master: { label: "Dorm Attendance", navLabel: "Dorm", href: "/dashboard/dorm-attendance", icon: "bed" },
  admin: { label: "Staff", navLabel: "Staff", href: "/dashboard/staff", icon: "person" },
  school_admin: { label: "Staff", navLabel: "Staff", href: "/dashboard/staff", icon: "person" },
  super_admin: { label: "Schools", navLabel: "Schools", href: "/dashboard/schools", icon: "school" },
};

// Staff who also teach get marks entry in the centre slot, because that is the
// job they do every morning. A bursar/teacher or headmaster/teacher previously
// saw only their admin action, leaving the task they came to do a menu tap away.
const TEACHING_QUICK_ACTION: QuickStep = {
  label: "Enter Marks",
  navLabel: "Marks",
  href: "/dashboard/grades",
  icon: "grade",
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open: openSidebar } = useSidebar();
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;
  // Everyone this person is, not just the one recorded as primary. Rural staff
  // routinely combine jobs — headmaster who teaches, bursar who teaches.
  const roles = user?.roles?.length ? user.roles : role ? [role] : [];

  const canUseAttendance = canAccessAny(roles, "attendance");
  const canUseFees = canAccessAny(roles, "fees");

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  // Home / Attend / Fees already have their own slots — the centre action
  // must never repeat one, even if a future ROLE_QUICK_ACTION entry does.
  const RESERVED_HREFS = ["/dashboard", "/dashboard/attendance", "/dashboard/fees"];

  // Constant per role set, and absent rather than invented when no role has an
  // entry — an invented fallback collided with Home.
  const quickStep = useMemo<QuickStep | null>(() => {
    if (roles.length === 0) return null;
    if (roles.includes("teacher")) {
      const step = TEACHING_QUICK_ACTION;
      if (!RESERVED_HREFS.includes(step.href)) return step;
    }
    for (const candidate of roles) {
      const step = ROLE_QUICK_ACTION[candidate] ?? null;
      if (step && !RESERVED_HREFS.includes(step.href)) return step;
    }
    return null;
  }, [roles]);

  const quickActive = quickStep ? isActive(quickStep.href) : false;

  // Exact match on the dashboard root only. isActive("/dashboard") also
  // matches "/dashboard/*", which lit Home alongside Fees/Students on every
  // subpage — reading as a second active Home. Trailing slash normalised
  // because next.config uses trailingSlash: true.
  const normalizedPath = (pathname ?? "").replace(/\/+$/, "") || "/";
  const isHome = normalizedPath === "/dashboard";

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {/* Home. */}
      <NavItem href="/dashboard" icon="home" label="Home" active={isHome} />
      {/* Attend */}
      {canUseAttendance && (
        <NavItem
          href="/dashboard/attendance"
          icon="how_to_reg"
          label="Attend"
          active={isActive("/dashboard/attendance")}
        />
      )}

      {/* Role-aware quick action stays in the same rhythm as the other
          destinations, and is omitted for roles that declare none. */}
      {quickStep && (
        <Link
          href={quickStep.href}
          className={`mobile-nav-item mobile-nav-action${quickActive ? " active" : ""}`}
          aria-label={quickStep.label}
          aria-current={quickActive ? "page" : undefined}
          title={quickStep.label}
          onClick={() => {
            try {
              navigator.vibrate?.(10);
            } catch {}
          }}
        >
          <MaterialIcon icon={quickStep.icon} style={{ fontSize: 22 }} />
          <span className="mobile-nav-label">{quickStep.navLabel}</span>
          {quickActive && <span className="mobile-nav-dot" aria-hidden />}
        </Link>
      )}

      {/* Fees */}
      {canUseFees && (
        <NavItem href="/dashboard/fees" icon="payments" label="Fees" active={isActive("/dashboard/fees")} />
      )}
      {/* More */}
      <button
        type="button"
        className="mobile-nav-item"
        onClick={() => {
          try {
            navigator.vibrate?.(10);
          } catch {}
          openSidebar();
        }}
        aria-label="Open more pages"
        title="More pages"
      >
        <MaterialIcon icon="apps" style={{ fontSize: 22 }} />
        <span className="mobile-nav-label">More</span>
      </button>
    </nav>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`mobile-nav-item${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      <MaterialIcon icon={icon} style={{ fontSize: 22 }} />
      <span className="mobile-nav-label">{label}</span>
      {active && <span className="mobile-nav-dot" aria-hidden />}
    </Link>
  );
}
```

## `src/components/OfflineIndicator.tsx`

```tsx
"use client";
import { memo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { offlineDB } from "@/lib/offline";
import MaterialIcon from "@/components/MaterialIcon";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";

export const OfflineIndicator = memo(function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  // Install prompt handled by PWAInstallPrompt component

  const syncData = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const pending = await offlineDB.getPendingSync();
      if (pending.length > 0) {
        await offlineDB.syncToServer("/api/sync");
      }
      const remaining = await offlineDB.getPendingSync();
      setPendingSync(remaining.length);
    } catch {
      // Sync will retry on next online event
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setShowIndicator(true);
      await syncData();
      setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    const checkPending = async () => {
      try {
        const online = navigator.onLine;
        setIsOnline(online);
        const pending = await offlineDB.getPendingSync();
        setPendingSync(pending.length);
        if (pending.length > 0) setShowIndicator(true);
      } catch {
        // Ignore errors
      }
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        syncData();
      }
    };

    void checkPending().then(() => {
      if (navigator.onLine) void syncData();
    });
    const interval = setInterval(checkPending, 30000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }

    setIsOnline(navigator.onLine);
    if (!navigator.onLine) setShowIndicator(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
      clearInterval(interval);
    };
  }, [syncData]);

  if (!showIndicator && isOnline && pendingSync === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "var(--mobile-nav-clearance, 84px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "var(--z-toast, 3000)",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {showIndicator && (syncing || !isOnline || pendingSync > 0) && (
        <div
          style={{
            padding: "10px 20px",
            borderRadius: 25,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            background: isOnline ? "#22c55e" : "#ef4444",
            color: "#fff",
            animation: "fadeInUp 0.3s ease",
          }}
        >
          {syncing ? (
            <>
              <MaterialIcon icon="sync" style={{ animation: "spin 1s linear infinite", fontSize: 16 }} />
              Syncing {pendingSync} items...
            </>
          ) : !isOnline ? (
            <>
              <MaterialIcon icon="wifi_off" style={{ fontSize: 16 }} />
              Offline - Changes saved locally
              {pendingSync > 0 && <span style={{ opacity: 0.9, fontWeight: 400 }}>({pendingSync} pending)</span>}
            </>
          ) : pendingSync > 0 ? (
            <>
              <MaterialIcon icon="cloud_upload" style={{ fontSize: 16 }} />
              {pendingSync} changes syncing
            </>
          ) : null}
          {(pendingSync > 0 || !isOnline) && (
            <Link
              href="/dashboard/sync-center"
              style={{
                marginLeft: 6,
                background: "#fff",
                color: isOnline ? "#15803d" : "#b91c1c",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              View Queue
            </Link>
          )}
        </div>
      )}

      <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    </div>
  );
});

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const pending = await offlineDB.getPendingSync();
        setPendingCount(pending.length);
      } catch (err) {
        logger.error("Failed to check pending sync:", err);
      }
    };

    check();
    const interval = setInterval(check, 5000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const sync = async () => {
    if (!navigator.onLine) return { success: 0, failed: 0 };
    return await offlineDB.syncToServer("/api/sync");
  };

  return { pendingCount, isOnline, sync };
}
```

## Root application wrapper

## `src/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-ux.css";
import "./mobile-responsive.css";
import "./globals-dark-hex.css";
import Providers from "./providers";
import DeferredChrome from "./deferred-chrome";
import DebugPing from "@/components/DebugPing";
import Script from "next/script";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://omuto.org"),
  title: `${APP_NAME} | Your Digital School Partner`,
  description:
    "The all-in-one school management system built for Ugandan schools. Track attendance, grades, fees, and send parent SMS — all from one dashboard. Start your free 30-day trial today.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-512x512.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  openGraph: {
    title: `${APP_NAME} | Your Digital School Partner`,
    description:
      "Attendance, grades, fees, and parent SMS — all in one system built for Ugandan schools. Start your free 30-day trial.",
    type: "website",
    url: "https://omuto.org",
    locale: "en_UG",
    siteName: APP_NAME,
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} | Your Digital School Partner`,
    description: "Run your entire school from one dashboard. Attendance, grades, fees, and parent SMS.",
    images: ["/icons/icon-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#001F3F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // Without this every env(safe-area-inset-*) in the app resolves to 0px, so
  // the mobile bottom nav sits under the home indicator and fixed action bars
  // sit under the browser chrome. See the paired .topbar rule in globals.css,
  // which had to become min-height so a real inset grows the bar instead of
  // crushing its content box.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        <link rel="preload" href="/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/sora-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-512x512.png" type="image/png" />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    var theme = 'light';
    var stored = null;
    try { stored = localStorage.getItem('skoolmate-theme'); } catch (e) {}
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
    window.__skoolmateTheme = theme;
  } catch (e) {}
})();`,
          }}
        />
        <Script
          id="lite-mode"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    var mem = navigator.deviceMemory || 0;
    var cores = navigator.hardwareConcurrency || 0;
    var saveData = (navigator.connection && navigator.connection.saveData) || false;
    var prefersReducedData = false;
    try { prefersReducedData = window.matchMedia('(prefers-reduced-data: reduce)').matches; } catch(e){}
    if ((mem && mem <= 3) || (cores && cores <= 4) || saveData || prefersReducedData) {
      document.documentElement.classList.add('lite');
    }
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body
        className="antialiased min-h-screen"
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--t1)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {process.env.NODE_ENV !== "production" && (
          <Script
            id="dev-sw-reset"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  try {
                    if (!('serviceWorker' in navigator)) return;
                    navigator.serviceWorker.getRegistrations().then(function (registrations) {
                      registrations.forEach(function (registration) {
                        registration.unregister();
                      });
                    }).catch(function () {});
                    if ('caches' in window) {
                      caches.keys().then(function (keys) {
                        keys.forEach(function (key) {
                          if (key.indexOf('skoolmate-') === 0) {
                            caches.delete(key);
                          }
                        });
                      }).catch(function () {});
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        )}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--navy)] focus:text-[var(--on-primary)] focus:rounded-lg"
        >
          Skip to main content
        </a>
        <Providers>
          {children}
          <DeferredChrome />
          <AppUpdatePrompt />
        </Providers>
        {process.env.NODE_ENV === "development" && <DebugPing />}
      </body>
    </html>
  );
}
```
