"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import { isRouteAllowed, MODULE_FOR_ROUTE } from "@/components/dashboard/AccessControlGuard";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAcademic } from "@/lib/academic-context";
import { APP_NAME } from "@/lib/app-name";
import { useAuth } from "@/lib/auth-context";
import { canUseModule, DEFAULT_FEATURE_STAGE, type FeatureStage, type ModuleKey } from "@/lib/featureStages";
import { getModuleDefinition } from "@/lib/modules/catalog";
import { getNavigationForRoles } from "@/lib/navigation";
import { type RoleRouteOverrides, resolveRouteAccess, useRoleRouteOverrides } from "@/lib/role-access-overrides";
import { type UserRole } from "@/lib/roles";
import { useSyncStatus } from "@/lib/useSyncStatus";

const CollapsibleSidebar = dynamic(() => import("@/components/CollapsibleSidebar"), { loading: () => null });
const ContactSupport = dynamic(() => import("@/components/ContactSupport"), { loading: () => null });

const ROUTE_TO_MODULE: Record<string, ModuleKey> = {};
for (const [route, mod] of Object.entries(MODULE_FOR_ROUTE)) {
  ROUTE_TO_MODULE[route] = mod;
}

function filterGroupsByFeatureStage(
  groups: readonly import("@/lib/navigation").NavGroup[],
  featureStage: FeatureStage | undefined,
  role: string | undefined,
  overrides: RoleRouteOverrides,
  billingMode: string,
  entitledModules: Set<string>,
): import("@/lib/navigation").NavGroup[] {
  const stage = featureStage || DEFAULT_FEATURE_STAGE;
  const typedRole = role as UserRole | undefined;

  const canAccessRoute = (href: string): boolean => {
    if (!typedRole) return false;
    return resolveRouteAccess(typedRole, href, isRouteAllowed(typedRole, href), overrides);
  };

  const isModuleAllowed = (mod: string | undefined): boolean => {
    if (!mod) return true; // no module gate
    if (billingMode === "modular") {
      // Free modules (is_billable false) always allowed; otherwise need entitlement
      const def = getModuleDefinition(mod as any);
      if (def && !def.is_billable) return true;
      return entitledModules.has(mod);
    }
    return canUseModule(stage, mod as any);
  };

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const mod = ROUTE_TO_MODULE[item.href];
        return isModuleAllowed(mod) && canAccessRoute(item.href);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

function SyncStatus() {
  const { isOnline, pendingCount, isSyncing } = useSyncStatus();

  return (
    <div className="flex items-center gap-[7px] text-xs font-medium text-[var(--green)]">
      <div
        className="w-[7px] h-[7px] rounded-full"
        style={{
          background: isOnline ? "var(--green)" : "var(--red)",
          animation: isOnline && !isSyncing ? "blink 2.5s ease-in-out infinite" : "none",
        }}
      />
      {isOnline ? (isSyncing ? "Syncing..." : "Online") : "Offline"}
      {pendingCount > 0 && (
        <span className="ml-auto text-xs text-[var(--amber)] font-[DM Mono]">{pendingCount} pending</span>
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

  // Modular billing: only show modules the school has paid for. Full-suite
  // mode keeps the existing feature-stage gating.
  const [billingMode, setBillingMode] = useState<string>("full_suite");
  const [entitledModules, setEntitledModules] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!school?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: schoolRow } = await supabase
          .from("schools")
          .select("billing_mode")
          .eq("id", school.id)
          .maybeSingle();
        if (cancelled) return;
        const mode = (schoolRow as { billing_mode?: string } | null)?.billing_mode || "full_suite";
        setBillingMode(mode);
        if (mode === "modular") {
          const { data: ents } = await supabase
            .from("school_module_entitlements")
            .select("module_key, status, ends_at")
            .eq("school_id", school.id);
          if (cancelled) return;
          const active = new Set<string>();
          for (const e of (ents || []) as { module_key: string; status: string; ends_at: string | null }[]) {
            if (
              (e.status === "active" || e.status === "trial") &&
              (!e.ends_at || new Date(e.ends_at).getTime() > Date.now())
            ) {
              active.add(e.module_key);
            }
          }
          setEntitledModules(active);
        }
      } catch {
        // fail open
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [school?.id]);

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
    billingMode,
    entitledModules,
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
      data-tour="sidebar"
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
          <div className="w-9 h-9 rounded-xl bg-[var(--surface-container-low)] flex items-center justify-center flex-shrink-0 ring-1 ring-[var(--border)]">
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
                src="/SkoolMate logos/SchoolMate icon.svg"
                alt={`${APP_NAME} Logo`}
                width={26}
                height={26}
                className="w-[26px] h-[26px] object-contain"
              />
            )}
          </div>
          {showExpanded && (
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--t1)] tracking-[-.15px] leading-tight truncate">
                {schoolName}
              </div>
              <div className="text-xs text-[var(--t3)] mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--green)] flex-shrink-0" />
                {user?.role?.replace("_", " ") || "User"}
                {currentTerm ? ` · Term ${currentTerm}` : ""}
              </div>
            </div>
          )}
          {!isDesktop && (
            <button
              onClick={() => close()}
              className="h-11 w-11 tap-44 rounded-lg border-none bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] cursor-pointer items-center justify-center transition-colors flex"
              aria-label="Close sidebar"
            >
              <MaterialIcon icon="close" style={{ fontSize: 18, color: "var(--t2)" }} />
            </button>
          )}
          {isDesktop && (
            <button
              onClick={() => setIsPinnedOpen((prev) => !prev)}
              className="h-11 w-11 flex-shrink-0 rounded-lg border-none bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] cursor-pointer items-center justify-center transition-colors flex"
              aria-label={isPinnedOpen ? "Collapse sidebar" : "Pin sidebar open"}
              title={isPinnedOpen ? "Collapse" : "Pin open"}
            >
              <MaterialIcon
                icon={isPinnedOpen ? "left_panel_close" : "left_panel_open"}
                style={{ fontSize: 18, color: "var(--t2)" }}
              />
            </button>
          )}
        </div>
      </div>

      <CollapsibleSidebar
        groups={navigationGroups}
        onNavigate={onNavigate}
        compact={isDesktop && !showExpanded}
        userId={user?.id}
      />

      {/*
          The "Bring your team aboard" card used to sit here, between the
          navigation and the footer. It was a promotion for a task a headmaster
          does once, taking a third of the drawer's height, and it pushed the
          pages they actually use further down. Staff are invited from the
          Staff page, which is one tap away in the menu.
        */}

      {showExpanded && (
        <div className="px-4 py-3 border-t border-[var(--border)] space-y-2">
          <SyncStatus />
          <ContactSupport variant="inline" label="Support" />
        </div>
      )}
    </aside>
  );
}
