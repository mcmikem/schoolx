"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
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

  if (isChecking || !isAuthorized) {
    return null;
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
