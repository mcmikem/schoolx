"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withTimeout } from "@/lib/hooks/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, Select } from "@/components/ui/index";

interface StaffMember {
  id: string;
  full_name: string;
  department: string;
  role: string;
}

interface StaffStat {
  staffId: string;
  name: string;
  department: string;
  role: string;
  avgRating: number;
  attendanceRate: number;
  reviewCount: number;
  hasSubstitution: boolean;
}

export default function StaffPerformancePage() {
  const { school } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<StaffStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const loadData = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);

    try {
      const schoolId = school.id;

      const { data: staffList, error: staffError } = await withTimeout(
        supabase
          .from("staff")
          .select("id, full_name, department, role")
          .eq("school_id", schoolId)
          .order("full_name"),
        15000,
        { data: [], error: null } as any,
      );

      if (staffError) {
        logger.error("Staff fetch error:", staffError);
        throw staffError;
      }

      const staffMembers: StaffMember[] = staffList || [];
      setStaff(staffMembers);

      const staffIds = staffMembers.map((s) => s.id);

      if (staffIds.length === 0) {
        setStats([]);
        return;
      }

      const [{ data: reviews }, { data: attendance }, { data: subs }] =
        await Promise.all([
          withTimeout(
            supabase
              .from("staff_reviews")
              .select("staff_id, rating")
              .in("staff_id", staffIds),
            15000,
            { data: [], error: null } as any,
          ),
          withTimeout(
            supabase
              .from("staff_attendance")
              .select("staff_id, status")
              .in("staff_id", staffIds),
            15000,
            { data: [], error: null } as any,
          ),
          withTimeout(
            supabase
              .from("teacher_substitutions")
              .select("teacher_id")
              .eq("school_id", schoolId)
              .in("teacher_id", staffIds),
            15000,
            { data: [], error: null } as any,
          ),
        ]);

      const ratingMap: Record<string, number[]> = {};
      (reviews || []).forEach((r: any) => {
        if (!ratingMap[r.staff_id]) ratingMap[r.staff_id] = [];
        ratingMap[r.staff_id].push(Number(r.rating) || 0);
      });

      const attendanceMap: Record<string, { total: number; present: number }> =
        {};
      (attendance || []).forEach((a: any) => {
        if (!attendanceMap[a.staff_id])
          attendanceMap[a.staff_id] = { total: 0, present: 0 };
        attendanceMap[a.staff_id].total += 1;
        if (a.status === "present") attendanceMap[a.staff_id].present += 1;
      });

      const subCounts: Record<string, number> = {};
      (subs || []).forEach((s: any) => {
        if (s.teacher_id) {
          subCounts[s.teacher_id] = (subCounts[s.teacher_id] || 0) + 1;
        }
      });

      const computed: StaffStat[] = staffMembers.map((s) => {
        const ratings = ratingMap[s.id] || [];
        const att = attendanceMap[s.id] || { total: 0, present: 0 };
        const avgRating =
          ratings.length > 0
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
            : 0;
        const attendanceRate = att.total > 0
          ? Math.round((att.present / att.total) * 100)
          : 0;

        return {
          staffId: s.id,
          name: s.full_name,
          department: s.department || "Unassigned",
          role: s.role || "Staff",
          avgRating,
          attendanceRate,
          reviewCount: ratings.length,
          hasSubstitution: (subCounts[s.id] || 0) > 0,
        };
      });

      setStats(computed);
    } catch (err) {
      logger.error("Failed to load staff performance data:", err);
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => {
    if (!school?.id) return;
    loadData();
  }, [school?.id, loadData]);

  const departments = useMemo(() => {
    const deps = new Set(staff.map((s) => s.department || "Unassigned"));
    return Array.from(deps).sort();
  }, [staff]);

  const filteredStats = useMemo(() => {
    if (departmentFilter === "all") return stats;
    return stats.filter(
      (s) => (s.department || "Unassigned") === departmentFilter,
    );
  }, [stats, departmentFilter]);

  const totalStaff = stats.length;
  const overallAvgRating =
    stats.length > 0
      ? stats.reduce((a, b) => a + b.avgRating, 0) / stats.length
      : 0;
  const overallAttendanceRate =
    stats.length > 0
      ? Math.round(
          stats.reduce((a, b) => a + b.attendanceRate, 0) / stats.length,
        )
      : 0;
  const substitutionRate =
    totalStaff > 0
      ? Math.round(
          (stats.filter((s) => s.hasSubstitution).length / totalStaff) * 100,
        )
      : 0;

  if (loading) {
    return (
      <div className="content space-y-6">
        <PageHeader
          title="Staff Performance"
          subtitle="Analytics and performance metrics for all staff"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse space-y-2"
            >
              <div className="h-3 bg-[var(--surface-container)] rounded w-20" />
              <div className="h-7 bg-[var(--surface-container)] rounded w-16" />
              <div className="h-3 bg-[var(--surface-container)] rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Staff",
      value: totalStaff,
      icon: "groups",
      color: "text-blue-700 bg-blue-50",
    },
    {
      label: "Avg Rating",
      value: overallAvgRating.toFixed(1),
      icon: "star",
      color: "text-amber-700 bg-amber-50",
    },
    {
      label: "Attendance Rate",
      value: `${overallAttendanceRate}%`,
      icon: "fact_check",
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Staff w/ Subs",
      value: `${substitutionRate}%`,
      icon: "swap_horiz",
      color: "text-purple-700 bg-purple-50",
    },
  ];

  return (
    <PageErrorBoundary>
      <div className="content space-y-6">
        <PageHeader
          title="Staff Performance"
          subtitle="Monitor staff reviews, attendance, and substitution metrics"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border border-[var(--border)] p-4 ${item.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MaterialIcon icon={item.icon as any} size={18} />
                <span className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">
                  {item.label}
                </span>
              </div>
              <div className="text-xl font-bold">{item.value}</div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
              <h3 className="font-semibold text-[var(--t1)]">
                Staff Performance Breakdown
              </h3>
              <div className="flex items-center gap-3">
                <Select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Departments" },
                    ...departments.map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-container-low)]">
                    <th className="text-left px-4 py-3 font-semibold text-[var(--t2)]">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--t2)]">
                      Department
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-[var(--t2)]">
                      Avg Rating
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-[var(--t2)]">
                      Attendance %
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-[var(--t2)]">
                      Reviews
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredStats.map((s) => (
                    <tr
                      key={s.staffId}
                      className="hover:bg-[var(--surface-container-low)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--t1)]">
                        {s.name}
                      </td>
                      <td className="px-4 py-3 text-[var(--t3)]">
                        {s.department}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.avgRating > 0 ? (
                          <div className="inline-flex items-center gap-1">
                            <MaterialIcon
                              icon="star"
                              size={14}
                              className="text-amber-500"
                            />
                            <span>{s.avgRating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--t4)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            s.attendanceRate >= 90
                              ? "success"
                              : s.attendanceRate >= 75
                                ? "warning"
                                : "error"
                          }
                        >
                          {s.attendanceRate}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--t3)]">
                        {s.reviewCount}
                      </td>
                    </tr>
                  ))}
                  {filteredStats.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-[var(--t4)]"
                      >
                        No staff data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageErrorBoundary>
  );
}
