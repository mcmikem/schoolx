"use client";

import { useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/index";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  MODULE_FOR_ROUTE,
  getPageTitle,
  roleBasedRoutes,
} from "@/components/dashboard/AccessControlGuard";
import {
  canUseModule,
  DEFAULT_FEATURE_STAGE,
  type FeatureStage,
} from "@/lib/featureStages";
import {
  normalizeRoleRouteOverrides,
  useRoleRouteOverrides,
  type RouteOverrideValue,
  type RoleRouteOverrides,
} from "@/lib/role-access-overrides";
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  type RolePermissions,
  type UserRole,
} from "@/lib/roles";
import { saveSchoolSetting } from "@/lib/school-settings";
import { ROLE_ROUTE_OVERRIDES_KEY } from "@/lib/role-access-overrides";

const ALL_FEATURES = Object.keys(PERMISSION_LABELS) as Array<keyof RolePermissions>;
const OVERRIDEABLE_ROUTES = Object.keys(roleBasedRoutes)
  .filter((route) => route !== "/dashboard")
  .sort();
const PROTECTED_ADMIN_ROLES = new Set<UserRole>([
  "super_admin",
  "school_admin",
  "admin",
  "headmaster",
]);

function formatRate(enabledCount: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((enabledCount / total) * 100)}%`;
}

export default function PermissionsPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const { overrides, loading, setOverrides } = useRoleRouteOverrides(school?.id);
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [moduleQuery, setModuleQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [selectedOverrideRole, setSelectedOverrideRole] = useState<UserRole>("teacher");
  const [saving, setSaving] = useState(false);

  const isManager = ["headmaster", "admin", "school_admin", "super_admin"].includes(
    user?.role || "",
  );
  const featureStage =
    (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE;

  const editableRoles = useMemo(() => {
    const managerRole = user?.role as UserRole | undefined;
    if (managerRole === "super_admin") {
      return ROLE_ORDER.filter((role) => role !== "super_admin");
    }
    return ROLE_ORDER.filter((role) => !PROTECTED_ADMIN_ROLES.has(role));
  }, [user?.role]);

  const normalizedRouteQuery = routeQuery.trim().toLowerCase();
  const filteredRoutes = useMemo(() => {
    return OVERRIDEABLE_ROUTES.filter((route) => {
      if (!normalizedRouteQuery) return true;
      const title = getPageTitle(route).toLowerCase();
      return route.toLowerCase().includes(normalizedRouteQuery) || title.includes(normalizedRouteQuery);
    });
  }, [normalizedRouteQuery]);

  const filteredFeatures = useMemo(() => {
    const term = moduleQuery.trim().toLowerCase();
    if (!term) return ALL_FEATURES;
    return ALL_FEATURES.filter((feature) => {
      const label = PERMISSION_LABELS[feature].toLowerCase();
      return label.includes(term) || feature.toLowerCase().includes(term);
    });
  }, [moduleQuery]);

  const roles = useMemo(() => {
    if (selectedRole === "all") return ROLE_ORDER;
    return ROLE_ORDER.filter((role) => role === selectedRole);
  }, [selectedRole]);

  const stats = useMemo(() => {
    const entries = ROLE_ORDER.map((role) => {
      const enabledCount = ALL_FEATURES.filter(
        (feature) => ROLE_PERMISSIONS[role][feature],
      ).length;
      return {
        role,
        enabledCount,
        total: ALL_FEATURES.length,
      };
    });

    const highest = entries.reduce((a, b) => (a.enabledCount >= b.enabledCount ? a : b));
    const lowest = entries.reduce((a, b) => (a.enabledCount <= b.enabledCount ? a : b));

    return { entries, highest, lowest };
  }, []);

  const selectedRoleOverrides =
    overrides[selectedOverrideRole] || {};

  const updateOverride = (
    role: UserRole,
    route: string,
    value: RouteOverrideValue | "inherit",
  ) => {
    setOverrides((prev) => {
      const next = normalizeRoleRouteOverrides(prev);
      const nextRoleMap = { ...(next[role] || {}) };

      if (value === "inherit") {
        delete nextRoleMap[route];
      } else {
        nextRoleMap[route] = value;
      }

      if (Object.keys(nextRoleMap).length === 0) {
        delete next[role];
      } else {
        next[role] = nextRoleMap;
      }

      return next;
    });
  };

  const handleSaveOverrides = async () => {
    if (!school?.id) {
      toast.error("No active school found");
      return;
    }

    setSaving(true);
    try {
      await saveSchoolSetting(school.id, ROLE_ROUTE_OVERRIDES_KEY, overrides);
      toast.success("Role access overrides saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save overrides");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Role Permissions Matrix"
          subtitle="Review default role access and apply school-specific route overrides within your package limits."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Most Access</p>
              <p className="mt-1 text-lg font-semibold text-[var(--t1)]">
                {ROLE_LABELS[stats.highest.role]}
              </p>
              <p className="text-sm text-[var(--t3)]">
                {stats.highest.enabledCount}/{stats.highest.total} modules ({formatRate(stats.highest.enabledCount, stats.highest.total)})
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Least Access</p>
              <p className="mt-1 text-lg font-semibold text-[var(--t1)]">
                {ROLE_LABELS[stats.lowest.role]}
              </p>
              <p className="text-sm text-[var(--t3)]">
                {stats.lowest.enabledCount}/{stats.lowest.total} modules ({formatRate(stats.lowest.enabledCount, stats.lowest.total)})
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-[var(--t3)]">Policy Status</p>
              <p className="mt-1 text-lg font-semibold text-[var(--t1)]">Configurable</p>
              <p className="text-sm text-[var(--t3)]">
                Base matrix is fixed, but Headmaster can set per-route overrides by school.
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--t1)]">Custom Route Overrides</p>
                <p className="text-xs text-[var(--t3)]">
                  Headmaster can grant or restrict route access per role. Locked modules cannot be enabled outside your feature stage.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--surface-container)] px-2 py-1 text-xs text-[var(--t3)]">
                  Stage: {featureStage}
                </span>
                <Button onClick={handleSaveOverrides} loading={saving} disabled={!isManager || saving || loading}>
                  Save Overrides
                </Button>
              </div>
            </div>

            {!isManager ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--t3)]">
                You can view overrides only. Editing is available to Headmaster/Admin roles.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-sm">
                    <MaterialIcon
                      icon="search"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
                    />
                    <input
                      type="text"
                      value={routeQuery}
                      onChange={(event) => setRouteQuery(event.target.value)}
                      placeholder="Search routes..."
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-3 text-sm text-[var(--t1)] outline-none ring-0 transition focus:border-[var(--primary)]"
                    />
                  </div>

                  <select
                    value={selectedOverrideRole}
                    onChange={(event) => setSelectedOverrideRole(event.target.value as UserRole)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--t1)] outline-none sm:w-72"
                  >
                    {editableRoles.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-container)] text-left">
                        <th className="px-3 py-2 font-semibold text-[var(--t2)]">Route</th>
                        <th className="px-3 py-2 font-semibold text-[var(--t2)]">Module Gate</th>
                        <th className="px-3 py-2 font-semibold text-[var(--t2)]">Override</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoutes.map((route) => {
                        const moduleKey = MODULE_FOR_ROUTE[route as keyof typeof MODULE_FOR_ROUTE];
                        const moduleAllowed = !moduleKey || canUseModule(featureStage, moduleKey);
                        const value = selectedRoleOverrides[route] || "inherit";

                        return (
                          <tr key={`${selectedOverrideRole}-${route}`} className="border-b border-[var(--border)] last:border-b-0">
                            <td className="px-3 py-2">
                              <p className="font-medium text-[var(--t1)]">{getPageTitle(route)}</p>
                              <p className="text-xs text-[var(--t3)]">{route}</p>
                            </td>
                            <td className="px-3 py-2">
                              {moduleKey ? (
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                    moduleAllowed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {moduleAllowed ? `${moduleKey} enabled` : `${moduleKey} locked by plan`}
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                  n/a
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={value}
                                disabled={!moduleAllowed}
                                onChange={(event) =>
                                  updateOverride(
                                    selectedOverrideRole,
                                    route,
                                    event.target.value as RouteOverrideValue | "inherit",
                                  )
                                }
                                className="w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--t1)]"
                              >
                                <option value="inherit">Inherit default</option>
                                <option value="allow">Allow</option>
                                <option value="deny">Deny</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <MaterialIcon
                  icon="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
                />
                <input
                  type="text"
                  value={moduleQuery}
                  onChange={(event) => setModuleQuery(event.target.value)}
                  placeholder="Search modules..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-3 text-sm text-[var(--t1)] outline-none ring-0 transition focus:border-[var(--primary)]"
                />
              </div>

              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as UserRole | "all")}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--t1)] outline-none sm:w-64"
              >
                <option value="all">All roles</option>
                {ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-container)] text-left">
                    <th className="px-3 py-2 font-semibold text-[var(--t2)]">Module</th>
                    {roles.map((role) => (
                      <th key={role} className="px-3 py-2 text-center font-semibold text-[var(--t2)]">
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFeatures.map((feature) => (
                    <tr key={feature} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-2 text-[var(--t1)]">{PERMISSION_LABELS[feature]}</td>
                      {roles.map((role) => {
                        const allowed = ROLE_PERMISSIONS[role][feature];
                        return (
                          <td key={`${role}-${feature}`} className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                allowed
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              <MaterialIcon icon={allowed ? "check_circle" : "cancel"} className="text-[14px]" />
                              {allowed ? "Allow" : "Deny"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredFeatures.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[var(--t3)]">
                No modules match your search.
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageErrorBoundary>
  );
}
