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
      // Show post-onboarding setup if onboarding is complete but setup is not
      setShowPostSetup(true);
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
