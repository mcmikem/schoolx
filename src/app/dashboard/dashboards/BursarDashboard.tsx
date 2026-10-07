"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import CollectionDonut from "@/components/dashboard/CollectionDonut";
import RecentPayments from "@/components/dashboard/RecentPayments";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import SchoolHero from "@/components/dashboard/SchoolHero";

import StatCard from "@/components/dashboard/StatCard";
import TaskManager from "@/components/dashboard/TaskManager";
import TopDefaulters from "@/components/dashboard/TopDefaulters";
import WeeklyCollections from "@/components/dashboard/WeeklyCollections";
import ErrorBoundary from "@/components/ErrorBoundary";
import MaterialIcon from "@/components/MaterialIcon";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { StuckLoadingOverlay, TopLoadingBar } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { formatCompactCurrency } from "@/lib/currency";
import {
  HIGH_RISK_ARREARS_THRESHOLD,
  MAX_RETURNED_DEFAULTERS,
  useFeePayments,
  useFeeStructure,
  useFeeSummary,
  useStudents,
} from "@/lib/hooks";
import type { FeeDefaulter } from "@/lib/hooks";
import { greetingFor, todayLabelFor } from "@/lib/utils";

function BursarDashboardContent() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students, loading: studentsLoading } = useStudents(school?.id, { limit: 1000 });
  const { payments, loading: paymentsLoading } = useFeePayments(school?.id);
  const { feeStructure, loading: feeStructureLoading } = useFeeStructure(school?.id);
  // Scoped to the term the header names. fee_summary() falls back to the
  // school's other fees when that term has none that apply, so this never
  // drops to zero just because a term has not been set up yet.
  const { summary: feeSummary, loading: feeSummaryLoading } = useFeeSummary(school?.id, currentTerm, academicYear);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const dataLoading = studentsLoading || paymentsLoading || feeStructureLoading || feeSummaryLoading;

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

  const currentDate = new Date();
  const greeting = greetingFor(currentDate);

  // Client-side totals — the fallback when fee_summary() cannot answer (demo
  // mode, offline, a timeout, or a deployment where the migration has not run
  // yet). It deliberately skips the RPC's term scoping: this path only ever
  // sees the first 100 students and 50 payments, so re-running the tier
  // fallback against a truncated roster would disagree with the database more
  // often than it agreed. In normal operation the RPC wins and these numbers
  // are not what the dashboard shows.
  const legacyFigures = useMemo(() => {
    const expected = students.reduce((total, student) => {
      const classFees = feeStructure.filter((f) => !f.class_id || f.class_id === student.class_id);
      return total + classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    }, 0);
    const collected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

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

    const debtors: FeeDefaulter[] = [];
    let highRisk = 0;
    for (const s of students) {
      const studentExpected = studentExpectedMap[s.id] || 0;
      const paid = studentPaidMap[s.id] || 0;
      if (studentExpected > 0 && paid < studentExpected) {
        debtors.push({
          student_id: s.id,
          first_name: s.first_name ?? null,
          last_name: s.last_name ?? null,
          parent_name: s.parent_name ?? null,
          parent_phone: s.parent_phone ?? null,
          class_name: s.classes?.name ?? null,
          balance: studentExpected - paid,
        });
      }
      if (Math.max(0, studentExpected - paid) >= HIGH_RISK_ARREARS_THRESHOLD) highRisk += 1;
    }
    debtors.sort((a, b) => b.balance - a.balance);

    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const currentKey = monthKey(now);
    const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let thisMonth = 0;
    let previousMonth = 0;
    for (const p of payments) {
      const amount = Number(p.amount_paid || 0);
      const key = monthKey(new Date(p.payment_date));
      if (key === currentKey) thisMonth += amount;
      else if (key === previousKey) previousMonth += amount;
    }

    return {
      studentsCount: students.length,
      expectedTotal: expected,
      collectedTotal: collected,
      overdueCount: debtors.length,
      highRiskCount: highRisk,
      thisMonthTotal: thisMonth,
      lastMonthTotal: previousMonth,
      overdueBalance: debtors.reduce((sum, d) => sum + d.balance, 0),
      defaulters: debtors.slice(0, MAX_RETURNED_DEFAULTERS),
    };
  }, [students, feeStructure, payments]);

  const figures = feeSummary ?? legacyFigures;
  const totalFeesExpected = figures.expectedTotal;
  const totalFeesCollected = figures.collectedTotal;
  const totalArrears = Math.max(0, totalFeesExpected - totalFeesCollected);
  const collectionRate = totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0;
  const overdueCount = figures.overdueCount;
  const highRiskArrearsCount = figures.highRiskCount;
  const thisMonthTotal = figures.thisMonthTotal;
  const lastMonthTotal = figures.lastMonthTotal;
  const collectionTrend =
    lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;
  const studentTotal = figures.studentsCount;

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
      // Arrears, not the plain balances list — "Record payment" above already
      // lands there. `status` is the filter the fees page reads from the URL;
      // the `tab=defaulters` these links used to carry is not one of the five
      // tabs that page accepts, so it silently fell back to Balances.
      href: "/dashboard/fees?status=unpaid",
      label: "Follow up arrears",
      icon: "campaign",
    },
    {
      href: "/dashboard/messages",
      label: "Send reminders",
      icon: "sms",
    },
  ];

  const todayLabel = todayLabelFor(currentDate);

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
        label: `${highRiskArrearsCount} high-risk arrears above UGX ${HIGH_RISK_ARREARS_THRESHOLD.toLocaleString()}`,
        icon: "warning",
        priority: "attention" as const,
        href: "/dashboard/fees?status=unpaid",
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
      <PageHeader
        title="Fees overview"
        subtitle={`${todayLabel} · Term ${currentTerm}, ${academicYear}`}
        actions={
          <>
            <Link href="/dashboard/fees" className="btn-pill btn-primary">
              <MaterialIcon icon="add" style={{ fontSize: 16 }} />
              Record payment
            </Link>
            <Link href="/dashboard/reports" className="btn-pill btn-secondary">
              Reports
            </Link>
          </>
        }
      />
      <SchoolHero
        school={school}
        greeting={greeting}
        userName={user?.full_name?.split(" ")[0] || ""}
        dateLabel={todayLabel}
        rightSection={
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--t3)]">
            Term {currentTerm} · {academicYear}
          </p>
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
              value={`UGX ${formatCompactCurrency(totalFeesExpected)}`}
              subValue={`${studentTotal} students`}
              icon="account_balance"
              accentColor="navy"
              loading={dataLoading}
              href="/dashboard/fees"
              hrefLabel="Open fees"
            />
            <StatCard
              label="Collected"
              value={`UGX ${formatCompactCurrency(totalFeesCollected)}`}
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
              value={`UGX ${formatCompactCurrency(totalArrears)}`}
              subValue={`${overdueCount} in arrears`}
              icon="warning"
              accentColor={totalArrears > 0 ? "red" : "green"}
              loading={dataLoading}
              href="/dashboard/fees?status=unpaid"
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

          {/* ── Analytics row (Donezo bento: weekly bars + progress donut) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3">
              <WeeklyCollections payments={payments} />
            </div>
            <div className="lg:col-span-2">
              <CollectionDonut collected={totalFeesCollected} expected={totalFeesExpected} />
            </div>
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
          <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--t1)]/10">
                <MaterialIcon icon="today" className="text-sm text-[var(--t1)]" />
              </div>
              <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">Today Actions</h2>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              {todayActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--surface-container-low)] bg-[var(--surface-bright)] p-3 transition-all hover:border-[var(--border)] hover:bg-[var(--primary-50)] hover:shadow-sm active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg text-[var(--t1)]">{action.icon}</span>
                  <span className="text-[11px] font-bold text-[var(--t1)]">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Exceptions First */}
          <div className="rounded-2xl border border-[var(--surface-container-low)] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--amber)]/10">
                <MaterialIcon icon="warning" className="text-sm text-[var(--amber)]" />
              </div>
              <h2 className="text-sm font-bold text-[var(--t1)] font-['Sora']">Exceptions First</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={`rounded-xl border p-3 ${totalArrears > 0 ? "border-[var(--red-soft)] bg-[var(--red-soft)]" : "border-[var(--green-soft)] bg-[var(--green-soft)]"}`}
              >
                <div className="text-xs font-semibold text-[var(--t1)]">Collection gap</div>
                <div
                  className={`text-sm font-bold mt-1 ${totalArrears > 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}
                >
                  {totalArrears > 0 ? `UGX ${totalArrears.toLocaleString()}` : "Target met"}
                </div>
              </div>
              <div
                className={`rounded-xl border p-3 ${highRiskArrearsCount > 0 ? "border-[var(--amber)] bg-[var(--amber-soft)]" : "border-[var(--surface-container-low)] bg-[var(--surface-bright)]"}`}
              >
                <div className="text-xs font-semibold text-[var(--t1)]">High-risk arrears</div>
                <div className="text-sm font-bold mt-1 text-[var(--t1)]">
                  {highRiskArrearsCount} above UGX {HIGH_RISK_ARREARS_THRESHOLD.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--surface-container-low)] bg-[var(--surface-bright)] p-3">
                <div className="text-xs font-semibold text-[var(--t1)]">Students in arrears</div>
                <div className="text-sm font-bold mt-1 text-[var(--t1)]">
                  {overdueCount} of {studentTotal}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--surface-container-low)] bg-[var(--surface-bright)] p-3">
                <div className="text-xs font-semibold text-[var(--t1)]">Month trend</div>
                <div
                  className={`text-sm font-bold mt-1 ${collectionTrend >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}
                >
                  {collectionTrend >= 0 ? "+" : ""}
                  {collectionTrend}% vs last month
                </div>
              </div>
            </div>
          </div>

          <TopDefaulters
            defaulters={figures.defaulters}
            debtorCount={figures.overdueCount}
            totalBalance={figures.overdueBalance}
          />
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
