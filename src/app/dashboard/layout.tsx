"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import ErrorBoundary from "@/components/ErrorBoundary";
import ExpiredNotice from "@/components/dashboard/ExpiredNotice";
import TrialBanner from "@/components/dashboard/TrialBanner";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import PostOnboardingSetup from "@/components/onboarding/PostOnboardingSetup";
import GoLiveGate from "@/components/GoLiveGate";
import {
  useAccessControl,
  getPageTitle,
} from "@/components/dashboard/AccessControlGuard";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { MinimalLoadingScreen, TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { useSchoolColors } from "@/lib/useSchoolColors";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import MaterialIcon from "@/components/MaterialIcon";
import OwlAssistant from "@/components/OwlAssistant";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import CommandPalette from "@/components/CommandPalette";
import { supabase } from "@/lib/supabase";

function hasCompletedSetupProgress(value: unknown): boolean {
  if (!value) return false;
  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value) : value;
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
  assets: { label: "Assets", icon: "inventory_2" },
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

function buildBreadcrumbs(
  pathname: string,
  pageTitle: string,
): { label: string; href?: string; icon?: string }[] {
  const items: { label: string; href?: string; icon?: string }[] = [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  ];
  if (!pathname || pathname === "/dashboard") return items;
  const parts = pathname.replace("/dashboard/", "").split("/");
  const sectionKey = parts[0];
  const section = SECTION_LABELS[sectionKey];
  if (section) {
    const sectionHref = `/dashboard/${sectionKey}`;
    if (parts.length === 1) {
      items.push({ label: section.label, icon: section.icon });
    } else {
      items.push({ label: section.label, href: sectionHref, icon: section.icon });
      items.push({ label: pageTitle });
    }
  } else {
    items.push({ label: pageTitle });
  }
  return items;
}

function SessionTimeoutWarning({
  remainingTime,
  onExtend,
}: {
  remainingTime: number;
  onExtend: () => void;
}) {
  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);
  const timeStr =
    minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session timeout warning"
      className="fixed inset-0 z-[9998] flex items-start sm:items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
    >
      <div className="bg-[var(--surface)] rounded-[var(--r)] shadow-[var(--sh3)] p-6 max-w-sm w-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <MaterialIcon icon="timer" className="text-yellow-600 text-2xl" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-[var(--t1)] mb-1">
          Session Expiring Soon
        </h2>
        <p className="text-sm text-[var(--t2)] mb-4">
          You will be signed out in{" "}
          <span className="font-bold text-[var(--error)]">{timeStr}</span> due
          to inactivity.
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

    if (user.role === "parent") {
      hasRedirectedRef.current = true;
      router.replace("/parent-portal");
      return;
    }

    if (user.role === "super_admin") {
      hasRedirectedRef.current = true;
      router.replace("/super-admin");
      return;
    }
  }, [authInitialized, loading, user, isDemo, router]);

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
  const currentPath =
    pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "");

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
  const hasOperationalStudentData =
    Number(schoolData?.student_count || 0) > 0;
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
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    const onboardingSessionKey =
      typeof window !== "undefined" && school?.id && user?.id
        ? `onboarding_shown_${school.id}|${user.id}`
        : null;

    if (
      school &&
      !onboardingCompleted &&
      user?.role === "school_admin" &&
      !isBillingPath &&
      isDashboardHome
    ) {
      // Avoid reopening onboarding on every refresh/navigation in a session.
      const alreadyShown =
        typeof window !== "undefined" && onboardingSessionKey
          ? sessionStorage.getItem(onboardingSessionKey)
          : null;

      if (!alreadyShown && onboardingSessionKey) {
        sessionStorage.setItem(onboardingSessionKey, "1");
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
      setShowPostSetup(false);
    } else if (
      school &&
      onboardingCompleted &&
      user?.role === "school_admin" &&
      isDashboardHome
    ) {
      setShowOnboarding(false);
      if (typeof window !== "undefined" && onboardingSessionKey) {
        sessionStorage.removeItem(onboardingSessionKey);
      }

      // Only auto-open the post-setup panel once per browser session.
      const sessionKey = user?.id
        ? `post_setup_shown_${school.id}|${user.id}`
        : null;
      if (
        typeof window !== "undefined" &&
        sessionKey &&
        !sessionStorage.getItem(sessionKey)
      ) {
        sessionStorage.setItem(sessionKey, "1");
        setShowPostSetup(true);
      }
    } else {
      setShowOnboarding(false);
      setShowPostSetup(false);
    }

    // Show go-live gate once per session for school_admins who completed onboarding
    if (
      school &&
      onboardingCompleted &&
      user?.role === "school_admin" &&
      isDashboardHome
    ) {
      const goLiveKey = user?.id
        ? `golive_shown_${school.id}|${user.id}`
        : null;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, isDashboardHome, onboardingCompleted, user?.role, user?.id]);

// Show minimal loading bar while auth is initializing.
  if (!authInitialized) {
    return <MinimalLoadingScreen message="Verifying your session..." />;
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
      {showWarning && (
        <SessionTimeoutWarning
          remainingTime={remainingTime}
          onExtend={extendSession}
        />
      )}
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

      {showPostSetup && !showOnboarding && (
        <PostOnboardingSetup onComplete={() => setShowPostSetup(false)} />
      )}

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

        <main
          id="main-content"
          className="main-content mobile-container xl:ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen xl:w-[calc(100%-var(--sidebar-width))]"
        >
          <TopBar pageTitle={pageTitle} onSignOut={handleSignOut} />
          {breadcrumbItems.length > 1 && (
            <div className="dashboard-breadcrumbs px-4 sm:px-6 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
          )}
          <TrialBanner />
          {children}
          <footer className="mt-auto px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] text-center">
            <p className="text-[11px] text-[var(--t4)]">
              Developed by{" "}
              <span className="font-semibold text-[var(--t3)]">IMAC Enterprises</span>
              {" "}·{" "}Powered by{" "}
              <span className="font-semibold text-[var(--t3)]">Omuto Foundation</span>
            </p>
          </footer>
        </main>
      </div>

      <MobileBottomNav />
      <OwlAssistant />
      <PWAInstallPrompt />
      <CommandPalette />
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
