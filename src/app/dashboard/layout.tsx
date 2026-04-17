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
import WorkflowGuide from "@/components/dashboard/WorkflowGuide";
import WhatsAppSupport from "@/components/WhatsAppSupport";
import SkoolMatePromo from "@/components/dashboard/SkoolMatePromo";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import PostOnboardingSetup from "@/components/onboarding/PostOnboardingSetup";
import {
  useAccessControl,
  getPageTitle,
} from "@/components/dashboard/AccessControlGuard";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import MaterialIcon from "@/components/MaterialIcon";

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
    >
      <div className="bg-[var(--surface)] rounded-[var(--r)] shadow-[var(--sh3)] p-6 max-w-sm w-full mx-4 text-center">
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
  const { user, school, loading, isDemo, isTrialExpired, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const hasCheckedAuth = useRef(false);
  const { close: closeSidebar } = useSidebar();

  useAccessControl();

  useEffect(() => {
    if (!loading) {
      hasCheckedAuth.current = true;
    }
    // Only redirect after we've finished checking AND determined no valid session
    if (hasCheckedAuth.current && !loading && !user && !isDemo) {
      router.replace("/login");
    }
  }, [loading, user, isDemo, router]);

  useEffect(() => {
    if (loading || !user || isDemo) return;

    if (user.role === "parent") {
      router.replace("/parent-portal");
      return;
    }

    if (user.role === "super_admin") {
      router.replace("/super-admin");
      return;
    }
  }, [loading, user, isDemo, router]);

  const handleSignOut = async () => {
    sessionStorage.removeItem("lastDeniedPath");
    await signOut();
    toast.success("Signed out successfully");
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

  // Session timeout – only active for real authenticated users (not demo)
  const { showWarning, remainingTime, extendSession } = useSessionTimeout({
    enabled: !!user && !isDemo && !loading,
    onTimeout: async () => {
      await signOut();
    },
  });

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPostSetup, setShowPostSetup] = useState(false);

  useEffect(() => {
    const schoolAny = school as any;
    if (
      school &&
      !schoolAny?.onboarding_completed &&
      user?.role === "school_admin"
    ) {
      setShowOnboarding(true);
    } else if (
      school &&
      schoolAny?.onboarding_completed &&
      user?.role === "school_admin"
    ) {
      // Only auto-open the post-setup panel once per browser session so that
      // it doesn't interrupt the user on every page refresh.
      const sessionKey = `post_setup_shown_${school.id}`;
      if (
        typeof window !== "undefined" &&
        !sessionStorage.getItem(sessionKey)
      ) {
        sessionStorage.setItem(sessionKey, "1");
        setShowPostSetup(true);
      }
    } else {
      setShowOnboarding(false);
      setShowPostSetup(false);
    }
  }, [school, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!user) return null;

  return (
    <ErrorBoundary>
      {showWarning && (
        <SessionTimeoutWarning
          remainingTime={remainingTime}
          onExtend={extendSession}
        />
      )}
      <OfflineIndicator />
      {isTrialExpired && <ExpiredNotice />}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => {
            setShowOnboarding(false);
            setShowPostSetup(true);
          }}
        />
      )}
      {showPostSetup && !showOnboarding && (
        <PostOnboardingSetup onComplete={() => setShowPostSetup(false)} />
      )}
      <div className="bg-motif flex min-h-screen bg-[var(--bg)]">
        <SidebarShell onNavigate={handleNavigate} />
        <SidebarOverlay />

        <main
          id="main-content"
          className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden"
        >
          <TopBar pageTitle={pageTitle} onSignOut={handleSignOut} />
          {breadcrumbItems.length > 1 && (
            <div className="px-4 sm:px-6 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
          )}
          <TrialBanner />
          <SkoolMatePromo />
          <WorkflowGuide />
          {children}
        </main>
      </div>

      <MobileBottomNav />
      <WhatsAppSupport />
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
