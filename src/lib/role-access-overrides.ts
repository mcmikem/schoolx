import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@/lib/roles";
import { loadSchoolSetting } from "@/lib/school-settings";

export const ROLE_ROUTE_OVERRIDES_KEY = "role_route_overrides_v1";

export type RouteOverrideValue = "allow" | "deny";

export type RoleRouteOverrides = Partial<
  Record<UserRole, Partial<Record<string, RouteOverrideValue>>>
>;

export function normalizeRoleRouteOverrides(
  input: unknown,
): RoleRouteOverrides {
  if (!input || typeof input !== "object") return {};
  const out: RoleRouteOverrides = {};
  for (const [role, routeMap] of Object.entries(input as Record<string, unknown>)) {
    if (!routeMap || typeof routeMap !== "object") continue;
    const normalizedRoutes: Record<string, RouteOverrideValue> = {};
    for (const [route, rawValue] of Object.entries(routeMap as Record<string, unknown>)) {
      if (rawValue === "allow" || rawValue === "deny") {
        normalizedRoutes[route] = rawValue;
      }
    }
    if (Object.keys(normalizedRoutes).length > 0) {
      out[role as UserRole] = normalizedRoutes;
    }
  }
  return out;
}

export function resolveRouteOverride(
  role: UserRole,
  pathnameOrHref: string,
  overrides: RoleRouteOverrides,
): RouteOverrideValue | null {
  const roleOverrides = overrides[role];
  if (!roleOverrides) return null;

  const matchingRoute = Object.keys(roleOverrides)
    .filter((route) => pathnameOrHref.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingRoute) return null;
  return roleOverrides[matchingRoute] || null;
}

export function resolveRouteAccess(
  role: UserRole,
  pathnameOrHref: string,
  baseAllowed: boolean,
  overrides: RoleRouteOverrides,
): boolean {
  const override = resolveRouteOverride(role, pathnameOrHref, overrides);
  if (override === "allow") return true;
  if (override === "deny") return false;
  return baseAllowed;
}

export function useRoleRouteOverrides(schoolId?: string) {
  const [overrides, setOverrides] = useState<RoleRouteOverrides>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!schoolId) {
      setOverrides({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const value = await loadSchoolSetting<RoleRouteOverrides>(
      schoolId,
      ROLE_ROUTE_OVERRIDES_KEY,
      {},
    );
    setOverrides(normalizeRoleRouteOverrides(value));
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { overrides, loading, setOverrides, reload };
}
