"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { getNavigationForRole, type NavGroup, type NavItem } from "@/lib/navigation";
import { canAccess, type UserRole } from "@/lib/roles";
import { canUseModule, type FeatureStage, type ModuleKey, DEFAULT_FEATURE_STAGE } from "@/lib/featureStages";
import { MODULE_FOR_ROUTE, roleBasedRoutes } from "@/components/dashboard/AccessControlGuard";
import { resolveRouteAccess, useRoleRouteOverrides, type RoleRouteOverrides } from "@/lib/role-access-overrides";

const ROUTE_TO_MODULE: Record<string, ModuleKey> = {};
for (const [route, mod] of Object.entries(MODULE_FOR_ROUTE)) {
  ROUTE_TO_MODULE[route] = mod;
}

const preferredRoutes = [
  "/dashboard",
  "/dashboard/store/inventory",
  "/dashboard/calendar",
  "/dashboard/messages",
  "/dashboard/staff",
  "/dashboard/settings",
] as const;

function filterGroupsByFeatureStage(
  groups: readonly NavGroup[],
  featureStage: FeatureStage | undefined,
  role: string | undefined,
  overrides: RoleRouteOverrides,
): NavGroup[] {
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

function dedupeByHref(items: readonly NavItem[]) {
  const seen = new Set<string>();
  const out: NavItem[] = [];
  for (const item of items) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(item);
  }
  return out;
}

function buildRailItems(groups: readonly NavGroup[]) {
  const all = dedupeByHref(groups.flatMap((g) => g.items));
  const preferred = preferredRoutes
    .map((href) => all.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i));

  if (preferred.length >= 4) {
    return preferred.slice(0, 5).map((item) => ({
      href: item.href,
      icon: item.icon,
      label: item.label,
    }));
  }

  return all.slice(0, 5).map((item) => ({
    href: item.href,
    icon: item.icon,
    label: item.label,
  }));
}

function isActivePath(path: string, href: string) {
  if (href === "/dashboard") return path === href;
  const pathOnly = href.split("?")[0];
  if (!pathOnly) return path === href;
  return path === pathOnly || path.startsWith(`${pathOnly}/`);
}

export default function PageUtilityRail() {
  const { user, school } = useAuth();
  const { overrides } = useRoleRouteOverrides(school?.id);
  const pathname = usePathname() || "/dashboard";

  const rawGroups = user?.role ? getNavigationForRole(user.role) : [];
  const groups = filterGroupsByFeatureStage(
    rawGroups,
    school?.feature_stage as FeatureStage | undefined,
    user?.role,
    overrides,
  );
  const railItems = buildRailItems(groups);

  if (railItems.length === 0) return null;

  return (
    <div className="px-4 pt-3 sm:px-6 xl:px-0 xl:pt-4">
      <nav
        aria-label="Quick page tools"
        className="flex items-center gap-2 overflow-x-auto rounded-[20px] border border-[#cfe0e4] bg-white/85 p-2 backdrop-blur xl:sticky xl:top-[84px] xl:flex-col xl:items-center xl:gap-3 xl:overflow-visible xl:py-3"
      >
        {railItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${active ? "border-[#0f7f8f] bg-[#0f7f8f] text-white" : "border-[#d9e8ec] bg-white text-[#6f8794] hover:bg-[#edf5f7]"}`}
            >
              <MaterialIcon icon={item.icon} className="text-[17px]" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}