"use client";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useSyncStatus } from "@/lib/useSyncStatus";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import ContactSupport from "@/components/ContactSupport";
import { getNavigationForRole } from "@/lib/navigation";
import { canAccess, type UserRole } from "@/lib/roles";
import { canUseModule, type FeatureStage, type ModuleKey, DEFAULT_FEATURE_STAGE } from "@/lib/featureStages";
import { MODULE_FOR_ROUTE, roleBasedRoutes } from "@/components/dashboard/AccessControlGuard";
import { resolveRouteAccess, useRoleRouteOverrides, type RoleRouteOverrides } from "@/lib/role-access-overrides";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";
import { APP_NAME } from "@/lib/app-name";
import { useEffect, useState } from "react";

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
    const routeKey = Object.keys(roleBasedRoutes).find((key) => href.startsWith(key));
    if (!routeKey) return true;
    const baseAllowed = canAccess(typedRole, roleBasedRoutes[routeKey]);
    return resolveRouteAccess(typedRole, href, baseAllowed, overrides);
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

    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1280);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const showExpanded = !isDesktop ? isOpen : isHovered || isPinnedOpen;
  const isVisible = isDesktop || isOpen;
  const rawGroups = user?.role ? getNavigationForRole(user.role) : [];
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
      // @ts-expect-error inert is valid but not yet in React types for this TS version
      inert={!isVisible ? "" : undefined}
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
              <div className="font-['Sora'] text-[14px] font-bold text-white tracking-[-.15px] leading-tight truncate">
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
              className="w-8 h-8 rounded-lg border-none bg-white/10 hover:bg-white/20 cursor-pointer items-center justify-center transition-colors flex"
              aria-label="Close sidebar"
            >
              <MaterialIcon icon="close" style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }} />
            </button>
          )}
          {isDesktop && (
            <button
              onClick={() => setIsPinnedOpen((prev) => !prev)}
              className="w-8 h-8 rounded-lg border-none bg-white/10 hover:bg-white/20 cursor-pointer items-center justify-center transition-colors flex"
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

      {showExpanded && (
        <div className="px-4 py-3 border-t border-[var(--border)] space-y-2">
          <SyncStatus />
          <ContactSupport variant="inline" label="Support" />
        </div>
      )}
    </aside>
  );
}
