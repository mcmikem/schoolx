"use client";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useFeePayments, useFeeStructure } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import TaskManager from "@/components/dashboard/TaskManager";

import StatCard from "@/components/dashboard/StatCard";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import TopDefaulters from "@/components/dashboard/TopDefaulters";
import RecentPayments from "@/components/dashboard/RecentPayments";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import SchoolHero from "@/components/dashboard/SchoolHero";
import { TopLoadingBar, StuckLoadingOverlay } from "@/components/ui/Skeleton";
import OwlMascot from "@/components/brand/OwlMascot";

function BursarDashboardContent() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students, loading: studentsLoading } = useStudents(school?.id);
  const { payments, loading: paymentsLoading } = useFeePayments(school?.id);
  const { feeStructure, loading: feeStructureLoading } = useFeeStructure(school?.id);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const dataLoading = studentsLoading || paymentsLoading || feeStructureLoading;

  useEffect(() => {
    if (!dataLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [dataLoading]);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return `${amount}`;
  };

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 17 ? "Good Afternoon" : "Good Evening";

  const totalFeesExpected = useMemo(
    () =>
      students.reduce((total, student) => {
        const classFees = feeStructure.filter((f) => !f.class_id || f.class_id === student.class_id);
        const studentExpected = classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
        return total + studentExpected;
      }, 0),
    [students, feeStructure],
  );

  const totalFeesCollected = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0),
    [payments],
  );
  const totalArrears = useMemo(
    () => Math.max(0, totalFeesExpected - totalFeesCollected),
    [totalFeesExpected, totalFeesCollected],
  );
  const collectionRate = useMemo(
    () => (totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0),
    [totalFeesExpected, totalFeesCollected],
  );

  const overdueCount = useMemo(() => {
    const studentExpectedMap: Record<string, number> = {};
    for (const student of students) {
      const classFees = feeStructure.filter((f) => !f.class_id || f.class_id === student.class_id);
      studentExpectedMap[student.id] = classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    }
    const studentPaidMap: Record<string, number> = {};
    for (const p of payments) {
      const sid = p.student_id;
      studentPaidMap[sid] = (studentPaidMap[sid] || 0) + Number(p.amount_paid || 0);
    }
    return students.filter((s) => {
      const expected = studentExpectedMap[s.id] || 0;
      const paid = studentPaidMap[s.id] || 0;
      return expected > 0 && paid < expected;
    }).length;
  }, [students, feeStructure, payments]);

  const recentPayments = useMemo(() => {
    const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
    return [...payments]
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 5)
      .map((p) => ({
        ...p,
        studentName: studentMap[p.student_id]
          ? `${studentMap[p.student_id].first_name || ""} ${studentMap[p.student_id].last_name || ""}`.trim()
          : "Unknown",
      }));
  }, [payments, students]);

  const thisMonthPayments = useMemo(
    () =>
      payments.filter((p) => {
        const d = new Date(p.payment_date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    [payments],
  );
  const lastMonthPayments = useMemo(
    () =>
      payments.filter((p) => {
        const d = new Date(p.payment_date);
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      }),
    [payments],
  );
  const thisMonthTotal = useMemo(
    () => thisMonthPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0),
    [thisMonthPayments],
  );
  const lastMonthTotal = useMemo(
    () => lastMonthPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0),
    [lastMonthPayments],
  );
  const collectionTrend = useMemo(
    () => (lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0),
    [thisMonthTotal, lastMonthTotal],
  );

  const highRiskArrearsCount = useMemo(() => {
    const studentExpectedMap: Record<string, number> = {};
    for (const student of students) {
      const classFees = feeStructure.filter((f) => !f.class_id || f.class_id === student.class_id);
      studentExpectedMap[student.id] = classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    }
    const studentPaidMap: Record<string, number> = {};
    for (const p of payments) {
      const sid = p.student_id;
      studentPaidMap[sid] = (studentPaidMap[sid] || 0) + Number(p.amount_paid || 0);
    }
    return students.filter((s) => {
      const expected = studentExpectedMap[s.id] || 0;
      const paid = studentPaidMap[s.id] || 0;
      return Math.max(0, expected - paid) >= 300000;
    }).length;
  }, [students, feeStructure, payments]);

  const todayActions = [
    {
      href: "/dashboard/fees",
      label: "Record payment",
      icon: "point_of_sale",
    },
    {
      href: "/dashboard/reports",
      label: "Collections report",
      icon: "analytics",
    },
    {
      href: "/dashboard/fees",
      label: "Follow up arrears",
      icon: "campaign",
    },
    {
      href: "/dashboard/messages",
      label: "Send reminders",
      icon: "sms",
    },
  ];

  const todayLabel = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const tasks = useMemo(() => {
    const items = [];
    if (totalArrears > 0) {
      items.push({
        id: "arrears",
        label: `${overdueCount} student${overdueCount > 1 ? "s" : ""} in arrears — UGX ${totalArrears.toLocaleString()} total`,
        icon: "payments",
        priority: "urgent" as const,
        href: "/dashboard/fees",
        cta: "View",
      });
    }
    if (highRiskArrearsCount > 0) {
      items.push({
        id: "high-risk",
        label: `${highRiskArrearsCount} high-risk arrears above UGX 300,000`,
        icon: "warning",
        priority: "attention" as const,
        href: "/dashboard/fees?tab=defaulters",
        cta: "Review",
      });
    }
    return items;
  }, [totalArrears, overdueCount, highRiskArrearsCount]);

  if ((!school?.id || dataLoading) && !loadingTimedOut) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <TopLoadingBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <OwlMascot size={52} premium ring glow animated />
            <p className="mt-4 text-sm text-[var(--t3)]">Loading your dashboard...</p>
          </div>
        </div>
        <StuckLoadingOverlay />
      </div>
    );
  }

  return (
    <div className="content overflow-x-hidden">
      <SchoolHero
        school={school}
        greeting={greeting}
        userName={user?.full_name?.split(" ")[0] || ""}
        dateLabel={todayLabel}
        rightSection={
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#42638d]">
            Term {currentTerm} · {academicYear}
          </p>
        }
        bottomCenter={
          <div className="text-xs text-[#42638d]">
            <span className="font-semibold">{students.length} students enrolled</span>
          </div>
        }
        bottomRight={
          collectionRate > 0 ? (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                collectionRate >= 70 ? "bg-[#1f8a70]/10" : "bg-[#c2472b]/10"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${collectionRate >= 70 ? "bg-[#1f8a70]" : "bg-[#c2472b]"}`} />
              <span className={`text-[11px] font-bold ${collectionRate >= 70 ? "text-[#1f8a70]" : "text-[#c2472b]"}`}>
                {collectionRate}% collected
              </span>
            </div>
          ) : undefined
        }
      />

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Left Column ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Fee metrics — shared StatCard with Donezo featured + ↗ affordance */}
          <div className="stat-grid !mb-0">
            <StatCard
              label="Expected"
              value={`UGX ${formatCurrency(totalFeesExpected)}`}
              subValue={`${students.length} students`}
              icon="account_balance"
              accentColor="navy"
              loading={dataLoading}
              href="/dashboard/fees"
              hrefLabel="Open fees"
            />
            <StatCard
              label="Collected"
              value={`UGX ${formatCurrency(totalFeesCollected)}`}
              icon="payments"
              accentColor="green"
              loading={dataLoading}
              variant="premium-teal"
              href="/dashboard/fees"
              hrefLabel="Open fees"
              trend={{
                value: Math.abs(collectionTrend),
                direction: collectionTrend > 0 ? "up" : collectionTrend < 0 ? "down" : "neutral",
                label: "vs last month",
              }}
            />
            <StatCard
              label="Arrears"
              value={`UGX ${formatCurrency(totalArrears)}`}
              subValue={`${overdueCount} in arrears`}
              icon="warning"
              accentColor={totalArrears > 0 ? "red" : "green"}
              loading={dataLoading}
              href="/dashboard/fees?tab=defaulters"
              hrefLabel="Open defaulters"
            />
            <StatCard
              label="Collection rate"
              value={`${collectionRate}%`}
              subValue={collectionRate >= 70 ? "On track" : "Needs follow-up"}
              icon="percent"
              accentColor={collectionRate >= 70 ? "green" : collectionRate >= 40 ? "amber" : "red"}
              loading={dataLoading}
              href="/dashboard/reports"
              hrefLabel="Open reports"
            />
          </div>

          <CollapsibleSection
            title="Task Manager"
            badge={tasks.length > 0 ? tasks.length : null}
            storageKey={`bursar-tasks-${school?.id}`}
            defaultOpen={tasks.length > 0}
          >
            <TaskManager tasks={tasks} emptyMessage="All caught up! No pending tasks." />
          </CollapsibleSection>

          {/* Today Actions */}
          <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#17325f]/10">
                <MaterialIcon icon="today" className="text-sm text-[#17325f]" />
              </div>
              <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">Today Actions</h2>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              {todayActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-2.5 rounded-xl border border-[#eef2f8] bg-[#f8fbff] p-3 transition-all hover:border-[#c8dce8] hover:bg-[#edf4ff] hover:shadow-sm active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg text-[#17325f]">{action.icon}</span>
                  <span className="text-[11px] font-bold text-[#17325f]">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Exceptions First */}
          <div className="rounded-2xl border border-[#eef2f8] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b45309]/10">
                <MaterialIcon icon="warning" className="text-sm text-[#b45309]" />
              </div>
              <h2 className="text-sm font-bold text-[#17325f] font-['Sora']">Exceptions First</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={`rounded-xl border p-3 ${totalArrears > 0 ? "border-[#f5d0c5] bg-[#ffefe8]" : "border-[#d8efe7] bg-[#f3fbf8]"}`}
              >
                <div className="text-xs font-semibold text-[#17325f]">Collection gap</div>
                <div className={`text-sm font-bold mt-1 ${totalArrears > 0 ? "text-[#c2472b]" : "text-[#1f8a70]"}`}>
                  {totalArrears > 0 ? `UGX ${totalArrears.toLocaleString()}` : "Target met"}
                </div>
              </div>
              <div
                className={`rounded-xl border p-3 ${highRiskArrearsCount > 0 ? "border-[#f5deb3] bg-[#fff8eb]" : "border-[#eef2f8] bg-[#f8fbff]"}`}
              >
                <div className="text-xs font-semibold text-[#17325f]">High-risk arrears</div>
                <div className="text-sm font-bold mt-1 text-[#17325f]">{highRiskArrearsCount} above UGX 300,000</div>
              </div>
              <div className="rounded-xl border border-[#eef2f8] bg-[#f8fbff] p-3">
                <div className="text-xs font-semibold text-[#17325f]">Students in arrears</div>
                <div className="text-sm font-bold mt-1 text-[#17325f]">
                  {overdueCount} of {students.length}
                </div>
              </div>
              <div className="rounded-xl border border-[#eef2f8] bg-[#f8fbff] p-3">
                <div className="text-xs font-semibold text-[#17325f]">Month trend</div>
                <div className={`text-sm font-bold mt-1 ${collectionTrend >= 0 ? "text-[#1f8a70]" : "text-[#c2472b]"}`}>
                  {collectionTrend >= 0 ? "+" : ""}
                  {collectionTrend}% vs last month
                </div>
              </div>
            </div>
          </div>

          <TopDefaulters students={students} feeStructure={feeStructure} payments={payments} />
          <RecentPayments payments={payments} students={students} thisMonthTotal={thisMonthTotal} />
        </div>

        {/* ── Right Column: Calendar ── */}
        <div className="space-y-5">
          <SchoolCalendar schoolId={school?.id} userId={user?.id} />
        </div>
      </div>
    </div>
  );
}

export default function BursarDashboard() {
  return (
    <ErrorBoundary>
      <BursarDashboardContent />
    </ErrorBoundary>
  );
}
