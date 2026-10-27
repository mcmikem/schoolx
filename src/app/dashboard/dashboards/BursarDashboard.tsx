"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import BursarReceiptPanel from "@/components/dashboard/BursarReceiptPanel";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import MoneyPositionStrip from "@/components/dashboard/MoneyPositionStrip";

import ErrorBoundary from "@/components/ErrorBoundary";
import MaterialIcon from "@/components/MaterialIcon";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { StuckLoadingOverlay, TopLoadingBar } from "@/components/ui/Skeleton";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import { formatCompactCurrency, formatCurrency } from "@/lib/currency";
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

type CollectionPeriod = "today" | "week" | "month";

const PERIODS: Array<{ value: CollectionPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function BursarDashboardContent() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students, loading: studentsLoading, error: studentsError } = useStudents(school?.id, { limit: 1000 });
  const {
    payments,
    loading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
  } = useFeePayments(school?.id);
  const { feeStructure, loading: feeStructureLoading, error: feeStructureError } = useFeeStructure(school?.id);
  // Scoped to the term the header names. fee_summary() falls back to the
  // school's other fees when that term has none that apply, so this never
  // drops to zero just because a term has not been set up yet.
  const { summary: feeSummary, loading: feeSummaryLoading } = useFeeSummary(school?.id, currentTerm, academicYear);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [period, setPeriod] = useState<CollectionPeriod>("week");
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
  const todayLabel = todayLabelFor(currentDate);

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

    return {
      studentsCount: students.length,
      expectedTotal: expected,
      collectedTotal: collected,
      overdueCount: debtors.length,
      highRiskCount: highRisk,
      overdueBalance: debtors.reduce((sum, d) => sum + d.balance, 0),
      defaulters: debtors.slice(0, MAX_RETURNED_DEFAULTERS),
    };
  }, [students, feeStructure, payments]);

  // Collections by period. The bursar decides a week or a month at a time, so
  // the same receipts answer today, this week and this month without another
  // round trip.
  const periodStats = useMemo(() => {
    const now = new Date();
    const monday = startOfDay(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const previousMonday = new Date(monday);
    previousMonday.setDate(monday.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const today = startOfDay(now).getTime();

    const weekBars = [0, 0, 0, 0, 0, 0, 0];
    const monthBars = [0, 0, 0, 0];
    const todayByMethod: Record<string, number> = {};
    let todayTotal = 0;
    let todayCount = 0;
    let weekTotal = 0;
    let weekCount = 0;
    let previousWeekTotal = 0;
    let monthTotal = 0;
    let monthCount = 0;
    let previousMonthTotal = 0;
    let latestPayment: Date | null = null;

    for (const payment of payments) {
      const paid = new Date(payment.payment_date);
      if (Number.isNaN(paid.getTime())) continue;
      const day = startOfDay(paid);
      const amount = Number(payment.amount_paid || 0);
      if (!latestPayment || day > latestPayment) latestPayment = day;

      if (day.getTime() === today) {
        todayTotal += amount;
        todayCount += 1;
        const method = String(payment.payment_method ?? "other");
        todayByMethod[method] = (todayByMethod[method] ?? 0) + amount;
      }
      if (day >= monday && day < nextMonday) {
        weekTotal += amount;
        weekCount += 1;
        weekBars[(day.getDay() + 6) % 7] += amount;
      } else if (day >= previousMonday && day < monday) {
        previousWeekTotal += amount;
      }
      if (day >= monthStart && day < nextMonth) {
        monthTotal += amount;
        monthCount += 1;
        monthBars[Math.min(3, Math.floor((day.getDate() - 1) / 7))] += amount;
      } else if (day >= previousMonth && day < monthStart) {
        previousMonthTotal += amount;
      }
    }

    return {
      todayTotal,
      todayCount,
      todayByMethod,
      weekTotal,
      weekCount,
      previousWeekTotal,
      weekBars,
      monthTotal,
      monthCount,
      previousMonthTotal,
      monthBars,
      latestPayment,
    };
  }, [payments]);

  const figures = feeSummary ?? legacyFigures;
  const totalFeesExpected = figures.expectedTotal;
  const totalFeesCollected = figures.collectedTotal;
  const totalArrears = Math.max(0, totalFeesExpected - totalFeesCollected);
  const collectionRate = totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0;
  const overdueCount = figures.overdueCount;
  const highRiskArrearsCount = figures.highRiskCount;
  const studentTotal = figures.studentsCount;

  // Fees are set per class, per term and per year. When the term the header
  // names has no fee items yet there is nothing to collect against, so
  // "Record payment" is a dead end and setting the fees is the task that
  // unblocks every other number on this page. Suppressed while loading so the
  // prompt does not flash on every visit.
  const hasCurrentTermFees = feeStructure.some(
    (f) => Number(f.term) === Number(currentTerm) && (!f.academic_year || f.academic_year === academicYear),
  );
  const noFeesAtAll = !feeStructureLoading && !feeStructureError && feeStructure.length === 0;

  const fallbackUnavailable = Boolean(studentsError || paymentsError || feeStructureError);
  const figuresReady = feeSummary !== null || (!dataLoading && !fallbackUnavailable);
  const sourceLabel = isDemo ? "Demo figures" : feeSummary ? "School-wide summary" : "Loaded-record estimate";

  const active =
    period === "today"
      ? { total: periodStats.todayTotal, count: periodStats.todayCount }
      : period === "week"
        ? { total: periodStats.weekTotal, count: periodStats.weekCount }
        : { total: periodStats.monthTotal, count: periodStats.monthCount };
  const previousTotal =
    period === "week" ? periodStats.previousWeekTotal : period === "month" ? periodStats.previousMonthTotal : null;
  const changePercent =
    previousTotal !== null && previousTotal > 0
      ? Math.round(((active.total - previousTotal) / previousTotal) * 100)
      : null;
  const comparison =
    changePercent === null
      ? null
      : `${changePercent >= 0 ? "+" : "−"}${Math.abs(changePercent)}% vs last ${period === "week" ? "week" : "month"}`;
  const barValues = period === "week" ? periodStats.weekBars : periodStats.monthBars;
  const barLabels = period === "week" ? WEEK_LETTERS : MONTH_LABELS;
  const barMax = Math.max(...barValues);
  const currentBar =
    period === "week" ? (currentDate.getDay() + 6) % 7 : Math.min(3, Math.floor((currentDate.getDate() - 1) / 7));

  const periodWord = period === "today" ? "today" : period === "week" ? "this week" : "this month";
  const latestPaymentLabel = periodStats.latestPayment
    ? periodStats.latestPayment.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const channels = [
    { key: "cash", label: "Cash", icon: "payments", amount: periodStats.todayByMethod.cash ?? 0 },
    {
      key: "mobile_money",
      label: "Mobile money",
      icon: "smartphone",
      amount: periodStats.todayByMethod.mobile_money ?? 0,
    },
    { key: "bank", label: "Bank", icon: "account_balance", amount: periodStats.todayByMethod.bank ?? 0 },
  ];
  const otherTakings = Object.entries(periodStats.todayByMethod)
    .filter(([method]) => !["cash", "mobile_money", "bank"].includes(method))
    .reduce((total, [, amount]) => total + amount, 0);

  const shortcuts = [
    { href: "/dashboard/fees", label: "Fee balances", icon: "account_balance_wallet" },
    { href: "/dashboard/fee-ledger", label: "Payment ledger", icon: "receipt_long" },
    { href: "/dashboard/fee-structure", label: "Fee structure", icon: "tune" },
    { href: "/dashboard/money", label: "Money in & out", icon: "swap_horiz" },
  ];

  const metrics = [
    {
      label: "Expected",
      value: formatCompactCurrency(totalFeesExpected, true),
      exact: formatCurrency(totalFeesExpected),
      hint: `${studentTotal} students`,
      href: "/dashboard/fees",
      tone: "text-[var(--t1)]",
    },
    {
      label: "Collected",
      value: formatCompactCurrency(totalFeesCollected, true),
      exact: formatCurrency(totalFeesCollected),
      hint: null,
      href: "/dashboard/fee-ledger",
      tone: "text-[var(--green-ink)]",
    },
    {
      label: "Outstanding",
      value: formatCompactCurrency(totalArrears, true),
      exact: formatCurrency(totalArrears),
      hint: `${overdueCount} in arrears`,
      href: "/dashboard/fees?status=unpaid",
      tone: "text-[var(--red-ink)]",
    },
    {
      label: "Collection rate",
      value: totalFeesExpected > 0 ? `${collectionRate}%` : "—",
      exact: totalFeesExpected > 0 ? `${collectionRate}%` : "No expected fees",
      hint: "of fees expected",
      href: "/dashboard/reports",
      tone: "text-[var(--primary)]",
    },
  ];

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
    <div className="content !gap-6 min-w-0">
      <PageHeader
        title={`${greeting}, ${user?.full_name?.split(" ")[0] || "Bursar"}`}
        subtitle={[school?.name, todayLabel, `Term ${currentTerm}, ${academicYear}`].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/reports" className="btn-pill btn-secondary">
              <MaterialIcon icon="analytics" className="text-lg" />
              Report
            </Link>
            <Link href="/dashboard/fees" className="btn-pill btn-primary">
              <MaterialIcon icon="add" className="text-lg" />
              Record payment
            </Link>
          </div>
        }
      />

      <section
        aria-label="Collections"
        className="overflow-hidden rounded-3xl bg-[var(--bot-navy)] text-white shadow-sm"
      >
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-100">Collected</p>
              <p className="mt-1 break-words text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                {paymentsLoading || paymentsError ? "—" : formatCurrency(active.total)}
              </p>
              <p className="mt-2 text-sm text-blue-100">
                {paymentsLoading
                  ? "Loading receipts…"
                  : paymentsError
                    ? "Receipts could not be loaded."
                    : active.count === 0
                      ? latestPaymentLabel
                        ? `No receipts ${periodWord} · last ${latestPaymentLabel}`
                        : `No receipts ${periodWord} yet`
                      : `${active.count} ${active.count === 1 ? "receipt" : "receipts"}${
                          comparison ? ` · ${comparison}` : ""
                        }`}
              </p>
            </div>
            <div
              role="group"
              aria-label="Collection period"
              className="flex w-full rounded-xl border border-white/20 p-1 sm:w-auto"
            >
              {PERIODS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={period === option.value}
                  onClick={() => setPeriod(option.value)}
                  className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-none sm:px-3 ${
                    period === option.value ? "bg-white text-[#123c35]" : "text-blue-100 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {!paymentsLoading && !paymentsError ? (
            period === "today" ? (
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 sm:grid-cols-3 sm:gap-6">
                {channels.map((channel) => (
                  <div key={channel.key} className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MaterialIcon icon={channel.icon} className="text-base text-[#b8f2dc]" />
                      <p className="text-[11px] font-medium leading-tight text-blue-100 sm:text-xs">{channel.label}</p>
                    </div>
                    <p
                      title={formatCurrency(channel.amount)}
                      className="mt-1 break-words text-lg font-bold tabular-nums leading-none"
                    >
                      {formatCompactCurrency(channel.amount)}
                    </p>
                  </div>
                ))}
                {otherTakings > 0 && (
                  <p className="col-span-3 text-[11px] text-blue-100">Other: {formatCurrency(otherTakings)}</p>
                )}
              </div>
            ) : (
              <div className="mt-6 border-t border-white/15 pt-5">
                <div
                  role="img"
                  aria-label={`${
                    period === "week" ? "Daily" : "Weekly"
                  } collections, total UGX ${active.total.toLocaleString()}`}
                  className="flex items-end gap-2 sm:gap-3"
                >
                  {barValues.map((value, index) => {
                    const height = barMax > 0 ? Math.max(8, Math.round((value / barMax) * 100)) : 8;
                    const isCurrent = index === currentBar;
                    return (
                      <div key={barLabels[index]} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-24 w-full items-end">
                          <div
                            title={`${barLabels[index]}: UGX ${value.toLocaleString()}`}
                            className={`w-full rounded-t-md ${
                              isCurrent ? "bg-[#b8f2dc]" : value > 0 ? "bg-white/45" : "bg-white/15"
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span
                          className={`truncate text-[10px] font-semibold ${
                            isCurrent ? "text-[#b8f2dc]" : "text-blue-100"
                          }`}
                        >
                          {barLabels[index]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-blue-100">
                  {formatCompactCurrency(active.total, true)} collected{" "}
                  {period === "week" ? "since Monday" : "this month"}
                </p>
              </div>
            )
          ) : null}
        </div>
      </section>

      <nav aria-label="Bursar quick actions" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <MaterialIcon icon={action.icon} className="shrink-0 text-lg text-[var(--primary)]" />
            <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{action.label}</span>
            <MaterialIcon
              icon="arrow_outward"
              className="hidden shrink-0 text-sm text-[var(--t3)] transition-opacity group-hover:opacity-100 sm:block"
            />
          </Link>
        ))}
      </nav>

      {!hasCurrentTermFees && !feeStructureLoading && !feeStructureError && (
        <section
          aria-label="Fee setup needed"
          className="flex flex-col gap-3 rounded-xl bg-[var(--amber-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <MaterialIcon icon="info" className="mt-0.5 shrink-0 text-xl text-[var(--amber-ink)]" />
            <div>
              <h2 className="text-sm font-bold text-[var(--amber-ink)]">
                {noFeesAtAll ? "Start by setting your fees" : `No fees set for Term ${currentTerm}, ${academicYear}`}
              </h2>
              <p className="mt-1 text-xs text-[var(--amber-ink)]">
                Collection progress is unknown until this term has fees.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/fee-structure"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--amber)]/40 bg-white px-4 text-sm font-bold text-[var(--amber-ink)]"
          >
            {noFeesAtAll ? "Set fees" : `Set Term ${currentTerm} fees`}
            <MaterialIcon icon="arrow_forward" className="text-base" />
          </Link>
        </section>
      )}

      <section aria-label="Fee summary" className="min-w-0 border-t border-[var(--border)] pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--t1)]">Term {currentTerm} fees</h2>
          <span className="text-xs text-[var(--t3)]">{sourceLabel}</span>
        </div>
        {!isDemo && !feeSummary && !feeSummaryLoading && (
          <p role="status" className="mt-2 text-xs text-[var(--amber-ink)]">
            {fallbackUnavailable
              ? "Some finance records could not be loaded, so these totals are unknown."
              : "Estimates use only loaded records. Verify totals in finance reports."}
          </p>
        )}
        {!figuresReady && (
          <p role="status" className="mt-2 text-xs text-[var(--t3)]">
            Loading summary…
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-[var(--border)]">
          {metrics.map((metric) => (
            <div key={metric.label + metric.href} className="min-w-0 sm:pr-5 sm:last:pr-0">
              <dt className="text-xs font-medium text-[var(--t3)]">{metric.label}</dt>
              <dd
                title={metric.exact}
                className={`mt-1 break-words text-xl font-bold tracking-tight tabular-nums ${metric.tone}`}
              >
                {figuresReady ? metric.value : "—"}
              </dd>
              {metric.hint && figuresReady && <p className="mt-0.5 text-xs text-[var(--t3)]">{metric.hint}</p>}
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Fee collection progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={figuresReady && totalFeesExpected > 0 ? Math.min(100, collectionRate) : undefined}
            aria-valuetext={
              figuresReady && totalFeesExpected > 0 ? `${collectionRate}% collected` : "Collection progress unavailable"
            }
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-container-high)]"
          >
            <div
              className="h-full rounded-full bg-[var(--green)]"
              style={{ width: `${figuresReady ? Math.min(100, collectionRate) : 0}%` }}
            />
          </div>
          <Link href="/dashboard/fees?status=unpaid" className="shrink-0 text-xs font-semibold text-[var(--primary)]">
            View arrears
          </Link>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <BursarReceiptPanel
          payments={payments}
          students={students}
          loading={paymentsLoading}
          error={paymentsError}
          onRetry={() => void refetchPayments()}
        />
        <section aria-labelledby="arrears-follow-up-title" className="min-w-0 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="arrears-follow-up-title" className="text-base font-bold text-[var(--t1)]">
              Arrears follow-up
            </h2>
            <span className="text-xs font-semibold text-[var(--amber-ink)]">
              {figuresReady ? `${overdueCount} accounts` : "—"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--t3)]">
            {figuresReady
              ? `${highRiskArrearsCount} balances of UGX ${HIGH_RISK_ARREARS_THRESHOLD.toLocaleString()} or more`
              : "Loading balances…"}
          </p>
          {figuresReady && figures.defaulters.length > 0 ? (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {figures.defaulters.slice(0, 4).map((student) => {
                const name = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
                return (
                  <li key={student.student_id}>
                    <Link
                      href={`/dashboard/fees?status=unpaid&q=${encodeURIComponent(name)}`}
                      className="flex min-h-14 items-center gap-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--amber-soft)] text-xs font-bold text-[var(--amber-ink)]"
                        aria-hidden="true"
                      >
                        {student.first_name?.[0]}
                        {student.last_name?.[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--t1)]">{name}</span>
                        <span className="block text-xs text-[var(--t3)]">
                          {student.class_name || "Class not available"}
                        </span>
                      </span>
                      <span
                        title={formatCurrency(student.balance)}
                        className="text-sm font-bold tabular-nums text-[var(--red-ink)]"
                      >
                        {formatCompactCurrency(student.balance, true)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-sm text-[var(--t3)]">
              {figuresReady ? "No outstanding accounts." : "Loading accounts…"}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-4">
            <Link
              href="/dashboard/fees?status=unpaid"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--primary)]"
            >
              View all arrears
              <MaterialIcon icon="arrow_forward" className="text-base" />
            </Link>
            <Link
              href="/dashboard/messages"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--t2)]"
            >
              <MaterialIcon icon="sms" className="text-base" />
              Send reminders
            </Link>
          </div>
        </section>
      </div>

      <MoneyPositionStrip />

      <CollapsibleSection
        title="School calendar"
        headerClassName="min-h-11"
        storageKey={`bursar-calendar-${school?.id}`}
        defaultOpen={false}
      >
        <SchoolCalendar schoolId={school?.id} userId={user?.id} />
      </CollapsibleSection>
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
