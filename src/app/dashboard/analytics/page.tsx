"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAnalytics } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function AnalyticsPage() {
  const { school, isDemo } = useAuth();
  const { data, loading: analyticsLoading } = useAnalytics(school?.id);
  const [activeTab, setActiveTab] = useState("overview");
  const [localLoading, setLocalLoading] = useState(true);

  // Fallback: ensure loading becomes false after timeout
  useEffect(() => {
    if (analyticsLoading) {
      const timeout = setTimeout(() => setLocalLoading(false), 8000);
      return () => clearTimeout(timeout);
    } else {
      setLocalLoading(false);
    }
  }, [analyticsLoading]);

  const loading = localLoading || analyticsLoading;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "students", label: "Students" },
    { id: "finance", label: "Finance" },
  ];

  // Fallback data when loading or no data
  const displayData =
    loading || !data?.stats?.totalStudents
      ? {
          stats: {
            totalStudents: isDemo ? 847 : 0,
            avgAttendance: isDemo ? 92 : 0,
            avgGrade: isDemo ? 74 : 0,
            feeCollectionRate: isDemo ? 78 : 0,
            projectedRevenue: isDemo ? 57500000 : 0,
            healthScore: isDemo ? 82 : 0,
          },
          genderDistribution: isDemo
            ? [
                { name: "Boys", value: 423, color: "#3b82f6" },
                { name: "Girls", value: 424, color: "#ec4899" },
              ]
            : [],
          attendanceTrends: isDemo
            ? [
                { name: "Week 1", value: 94 },
                { name: "Week 2", value: 92 },
                { name: "Week 3", value: 89 },
                { name: "Week 4", value: 91 },
              ]
            : [],
        }
      : data;

  if (loading && !isDemo) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader title="Analytics" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4"
            >
              <div className="h-3 w-16 bg-[var(--surface-container)] rounded animate-pulse mb-3" />
              <div className="h-7 w-24 bg-[var(--surface-container)] rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-[var(--surface-container)] rounded animate-pulse" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <PageErrorBoundary>
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Strategic insights for school management"
        actions={
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-[10px] text-green font-bold uppercase tracking-wider">
                Health Score
              </p>
              <p className="text-xl font-bold text-[var(--on-surface)]">
                {displayData.stats.healthScore ?? "—"}%
              </p>
            </div>
          </div>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel activeTab={activeTab} tabId="overview">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="!bg-surface-container-low/40">
            <CardBody className="space-y-2">
              <p className="text-[10px] text-[var(--on-surface-variant)] font-bold uppercase tracking-widest">
                Total Students
              </p>
              <p className="text-3xl font-bold text-[var(--on-surface)]">
                {displayData.stats.totalStudents}
              </p>
              <div className="flex items-center gap-1 text-green text-xs font-bold">
                <MaterialIcon icon="trending_up" className="text-sm" />
                <span>
                  +{displayData.stats.totalStudents > 0 ? "—" : "0"} vs last
                  term
                </span>
              </div>
            </CardBody>
          </Card>
          <Card className="!bg-surface-container-low/40">
            <CardBody className="space-y-2">
              <p className="text-[10px] text-[var(--on-surface-variant)] font-bold uppercase tracking-widest">
                Fee Collection
              </p>
              <p className="text-3xl font-bold text-[var(--on-surface)]">
                {Math.round(displayData.stats.feeCollectionRate)}%
              </p>
              <div className="h-1.5 w-full bg-[var(--surface-container-highest)] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[var(--primary)]"
                  style={{ width: `${displayData.stats.feeCollectionRate}%` }}
                />
              </div>
            </CardBody>
          </Card>
          <Card className="!bg-surface-container-low/40">
            <CardBody className="space-y-2">
              <p className="text-[10px] text-[var(--on-surface-variant)] font-bold uppercase tracking-widest">
                Avg. Grade
              </p>
              <p className="text-3xl font-bold text-[var(--on-surface)]">
                {displayData.stats.avgGrade}%
              </p>
              <p className="text-xs text-[var(--on-surface-variant)] italic">
                School average
              </p>
            </CardBody>
          </Card>
          <Card className="!bg-surface-container-low/40">
            <CardBody className="space-y-2">
              <p className="text-[10px] text-[var(--on-surface-variant)] font-bold uppercase tracking-widest">
                Avg. Attendance
              </p>
              <p className="text-3xl font-bold text-[var(--on-surface)]">
                {displayData.stats.avgAttendance}%
              </p>
              <p className="text-xs text-[var(--on-surface-variant)] italic">
                Last 30 days
              </p>
            </CardBody>
          </Card>
          <Card className="!bg-surface-container-low/40">
            <CardBody className="space-y-2">
              <p className="text-[10px] text-[var(--on-surface-variant)] font-bold uppercase tracking-widest">
                Projected Revenue
              </p>
              <p className="text-xl font-bold text-[var(--on-surface)]">
                UGX {displayData.stats.projectedRevenue.toLocaleString()}
              </p>
              <p className="text-[10px] text-[var(--primary)] font-bold uppercase">
                Term Total
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="!bg-surface-container-low/40">
            <CardBody>
              <h2 className="text-lg font-bold text-[var(--on-surface)] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[var(--primary)] rounded-full" />
                Revenue vs. Outstanding
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayData.revenueProjections}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="var(--navy)" />
                      <Cell fill="var(--outline-variant)" opacity={0.3} />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-container-highest)",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "var(--on-surface)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-8 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--primary)]" />
                  <p className="text-xs text-[var(--on-surface-variant)] font-medium">
                    Collected
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--outline-variant)] opacity-40" />
                  <p className="text-xs text-[var(--on-surface-variant)] font-medium">
                    Outstanding
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="!bg-surface-container-low/40">
            <CardBody>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[var(--on-surface)] flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-[var(--error)] rounded-full" />
                  At-Risk Students
                </h2>
                <span className="px-2 py-1 bg-red-500/10 text-red text-[10px] font-bold rounded uppercase tracking-wider">
                  High Priority
                </span>
              </div>
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 no-scrollbar">
                {displayData.atRiskStudents.map((s: any) => (
                  <div
                    key={s.student_id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--outline-variant)]/10 hover:bg-[var(--surface-bright)] transition-all"
                  >
                    <div>
                      <p className="text-sm font-bold text-[var(--on-surface)]">
                        {s.full_name}
                      </p>
                      <p className="text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wide">
                        {s.class_name} · {s.risk_reason.replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xs font-bold ${s.attendance_rate < 75 ? "text-red" : "text-[var(--on-surface-variant)]"}`}
                      >
                        Att: {Math.round(s.attendance_rate)}%
                      </p>
                      <p
                        className={`text-[10px] font-medium ${s.avg_score < 50 ? "text-red" : "text-[var(--on-surface-variant)]"}`}
                      >
                        Avg: {Math.round(s.avg_score)}%
                      </p>
                    </div>
                  </div>
                ))}
                {displayData.atRiskStudents.length === 0 && (
                  <EmptyState
                    icon="check_circle"
                    title="All students are meeting thresholds"
                  />
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 !bg-surface-container-low/40">
            <CardBody>
              <h2 className="text-lg font-bold text-[var(--on-surface)] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[var(--primary)] rounded-full" />
                Gender Distribution per Class
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayData.genderDistribution}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--outline-variant)"
                      opacity={0.1}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="var(--on-surface-variant)"
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--on-surface-variant)"
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{
                        fill: "var(--surface-container-highest)",
                        opacity: 0.1,
                      }}
                      contentStyle={{
                        background: "var(--surface-container-highest)",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="var(--navy)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card className="!bg-surface-container-low/40">
            <CardBody>
              <h2 className="text-lg font-bold text-[var(--on-surface)] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-amber rounded-full" />
                Academic Alerts
              </h2>
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <MaterialIcon icon="notifications_none" className="text-4xl text-[var(--t4)]" />
                <p className="text-sm font-semibold text-[var(--t2)]">No alerts right now</p>
                <p className="text-xs text-[var(--t4)] max-w-[200px] leading-relaxed">
                  Alerts will appear here when grades, attendance or fees need your attention.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="students">
        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-[var(--on-surface)] mb-4">
              Student Analytics
            </h2>
            {displayData.stats.totalStudents === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <MaterialIcon icon="group" className="text-5xl text-[var(--t4)]" />
                <p className="text-sm font-semibold text-[var(--t2)]">No student data yet</p>
                <p className="text-xs text-[var(--t4)] max-w-[240px] leading-relaxed">
                  Add students and record attendance to see analytics here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-container-low)] text-center">
                    <p className="text-2xl font-bold text-[var(--on-surface)]">{displayData.stats.totalStudents}</p>
                    <p className="text-xs text-[var(--t4)] mt-1">Total Students</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-container-low)] text-center">
                    <p className="text-2xl font-bold text-[var(--on-surface)]">{displayData.stats.avgAttendance}%</p>
                    <p className="text-xs text-[var(--t4)] mt-1">Avg Attendance</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-container-low)] text-center">
                    <p className="text-2xl font-bold text-[var(--on-surface)]">{displayData.stats.avgGrade}%</p>
                    <p className="text-xs text-[var(--t4)] mt-1">Avg Grade</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-container-low)] text-center">
                    <p className="text-2xl font-bold text-[var(--on-surface)]">{displayData.stats.healthScore}%</p>
                    <p className="text-xs text-[var(--t4)] mt-1">Health Score</p>
                  </div>
                </div>
                {displayData.genderDistribution?.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={displayData.genderDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--t3)' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--t3)' }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="var(--primary)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="finance">
        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-[var(--on-surface)] mb-4">
              Financial Analytics
            </h2>
            {displayData.stats.projectedRevenue === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <MaterialIcon icon="payments" className="text-5xl text-[var(--t4)]" />
                <p className="text-sm font-semibold text-[var(--t2)]">No fee data yet</p>
                <p className="text-xs text-[var(--t4)] max-w-[240px] leading-relaxed">
                  Set up fee terms and record payments to see financial analytics here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--surface-container-low)]">
                  <p className="text-xs text-[var(--t4)] mb-1">Collection Rate</p>
                  <p className="text-2xl font-bold text-[var(--on-surface)]">{Math.round(displayData.stats.feeCollectionRate)}%</p>
                  <div className="h-1.5 w-full bg-[var(--border)] rounded-full mt-2">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${displayData.stats.feeCollectionRate}%` }} />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface-container-low)]">
                  <p className="text-xs text-[var(--t4)] mb-1">Projected Revenue</p>
                  <p className="text-lg font-bold text-[var(--on-surface)]">UGX {displayData.stats.projectedRevenue.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </TabPanel>
    </div>
    </PageErrorBoundary>
  );
}
