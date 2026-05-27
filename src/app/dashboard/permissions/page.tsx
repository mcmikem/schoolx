"use client";

import { useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  type RolePermissions,
  type UserRole,
} from "@/lib/roles";

const ALL_FEATURES = Object.keys(PERMISSION_LABELS) as Array<keyof RolePermissions>;

function formatRate(enabledCount: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((enabledCount / total) * 100)}%`;
}

export default function PermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [query, setQuery] = useState("");

  const filteredFeatures = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return ALL_FEATURES;
    return ALL_FEATURES.filter((feature) => {
      const label = PERMISSION_LABELS[feature].toLowerCase();
      return label.includes(term) || feature.toLowerCase().includes(term);
    });
  }, [query]);

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

  return (
    <PageErrorBoundary>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Role Permissions Matrix"
          subtitle="Review what each role can access and spot over/under-privileged roles quickly."
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
              <p className="mt-1 text-lg font-semibold text-[var(--t1)]">Locked</p>
              <p className="text-sm text-[var(--t3)]">
                Role definitions are immutable at runtime and enforced by route guards.
              </p>
            </CardBody>
          </Card>
        </div>

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
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
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
