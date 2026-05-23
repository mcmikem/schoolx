"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SidebarShell from "@/components/dashboard/SidebarShell";
import TopBar from "@/components/dashboard/TopBar";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { useParentPortalGuard } from "@/lib/hooks/useParentPortalGuard";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

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

function ParentPortalShellContent({
  children,
  pageTitle,
}: {
  children: React.ReactNode;
  pageTitle: string;
}) {
  const { close: closeSidebar } = useSidebar();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarShell onNavigate={() => closeSidebar()} />
      <SidebarOverlay />
      <main
        id="main-content"
        className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden"
      >
        <TopBar pageTitle={pageTitle} onSignOut={handleSignOut} />
        {children}
      </main>
    </div>
  );
}

export default function ParentPortalShell({
  children,
  pageTitle,
}: {
  children: React.ReactNode;
  pageTitle: string;
}) {
  const { isAuthorized, isChecking } = useParentPortalGuard();

  if (isChecking) {
    return (
      <PageErrorBoundary>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-sm w-full bg-white border border-[var(--border)] rounded-2xl p-6 text-center shadow-[var(--sh2)]">
            <div className="text-sm font-semibold text-[var(--t1)]">Loading parent portal...</div>
            <div className="text-xs text-[var(--t3)] mt-2">Checking your account access and child records.</div>
          </div>
        </div>
      </PageErrorBoundary>
    );
  }

  if (!isAuthorized) {
    return (
      <PageErrorBoundary>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-sm w-full bg-white border border-[var(--border)] rounded-2xl p-6 text-center shadow-[var(--sh2)]">
            <div className="text-base font-semibold text-[var(--t1)]">Parent portal access unavailable</div>
            <div className="text-sm text-[var(--t3)] mt-2">
              Your account cannot open the parent portal right now. Please contact your school administrator.
            </div>
            <Link
              href="/login"
              className="inline-flex mt-5 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold"
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
      <SidebarProvider>
        <ParentPortalShellContent pageTitle={pageTitle}>
          {children}
        </ParentPortalShellContent>
      </SidebarProvider>
    </PageErrorBoundary>
  );
}
