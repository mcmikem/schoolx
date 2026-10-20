"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OwlMascot from "@/components/brand/OwlMascot";
import BursarReceiptPanel from "@/components/dashboard/BursarReceiptPanel";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import MoneyPositionStrip from "@/components/dashboard/MoneyPositionStrip";

import WeeklyCollections from "@/components/dashboard/WeeklyCollections";
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
    // Today's takings, by channel. A bursar checks this first thing in the
    // morning, and on reporting day it is the number they report to the head.
    const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const today = dayKey(now);
    let todayTotal = 0;
    let todayCount = 0;
    const todayByMethod: Record<string, number> = {};
    for (const p of payments) {
      const amount = Number(p.amount_paid || 0);
      const key = monthKey(new Date(p.payment_date));
      if (key === currentKey) thisMonth += amount;
      else if (key === previousKey) previousMonth += amount;
      if (dayKey(new Date(p.payment_date)) === today) {
        todayTotal += amount;
        todayCount += 1;
        const method = String(p.payment_method ?? "other");
        todayByMethod[method] = (todayByMethod[method] ?? 0) + amount;
      }
    }

    return {
      studentsCount: students.length,
      expectedTotal: expected,
      collectedTotal: collected,
      overdueCount: debtors.length,
      highRiskCount: highRisk,
      thisMonthTotal: thisMonth,
      lastMonthTotal: previousMonth,
      todayTotal,
      todayCount,
      todayByMethod,
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
  // The fee_summary() RPC is a term-level rollup and does not return these,
  // so the locally derived figures are always the source for today.
  const todayTotal = legacyFigures.todayTotal;
  const todayCount = legacyFigures.todayCount;
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

  const todayLabel = todayLabelFor(currentDate);
  const fallbackUnavailable = Boolean(studentsError || paymentsError || feeStructureError);
  const figuresReady = feeSummary !== null || (!dataLoading && !fallbackUnavailable);
  const sourceLabel = isDemo ? "Demo figures" : feeSummary ? "School-wide summary" : "Loaded-record estimate";
  const channels = [
    { label: "Cash", icon: "payments", amount: legacyFigures.todayByMethod.cash ?? 0 },
    { label: "Mobile money", icon: "smartphone", amount: legacyFigures.todayByMethod.mobile_money ?? 0 },
    { label: "Bank", icon: "account_balance", amount: legacyFigures.todayByMethod.bank ?? 0 },
  ];
  const otherTakings = Object.entries(legacyFigures.todayByMethod)
    .filter(([method]) => !["cash", "mobile_money", "bank"].includes(method))
    .reduce((total, [, amount]) => total + amount, 0);
  const shortcuts = [
    { href: "/dashboard/fees", label: "Fee balances", icon: "account_balance_wallet", hint: "View student accounts" },
    { href: "/dashboard/fee-ledger", label: "Payment ledger", icon: "receipt_long", hint: "Find a recorded receipt" },
    { href: "/dashboard/fee-structure", label: "Fee structure", icon: "tune", hint: "Manage charges" },
    { href: "/dashboard/money", label: "Income & expenses", icon: "swap_horiz", hint: "Track money in and out" },
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
    <div className="content !gap-5 min-w-0">
      <PageHeader
        title="Fees overview"
        subtitle={`${greeting}, ${user?.full_name?.split(" ")[0] || "Bursar"}. Your finance desk, at a glance.`}
        actions={
          <Link href="/dashboard/reports" className="btn-pill btn-secondary">
            <MaterialIcon icon="analytics" className="text-lg" />
            Collections report
          </Link>
        }
      />

      <section
        aria-label="Daily collections"
        className="overflow-hidden rounded-3xl bg-[var(--bot-navy)] text-white shadow-sm"
      >
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-medium text-blue-100">
              <span className="rounded-full border border-white/20 px-3 py-1.5">BURSAR WORKSPACE</span>
              <span>
                Term {currentTerm} · {academicYear}
              </span>
            </div>
            <h2 className="text-sm font-medium text-blue-100">Today&apos;s collections</h2>
            <p className="mt-2 break-words text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
              {paymentsLoading || paymentsError ? "—" : formatCurrency(todayTotal)}
            </p>
            <p className="mt-2 text-sm text-blue-100">
              {paymentsLoading
                ? "Loading receipts…"
                : paymentsError
                  ? "Receipts could not be loaded."
                  : `${todayCount} ${todayCount === 1 ? "receipt" : "receipts"} dated today in loaded records`}
            </p>
            <Link
              href="/dashboard/fees"
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#b8f2dc] px-5 text-sm font-bold text-[#123c35] transition-colors hover:bg-[#d1fae9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <MaterialIcon icon="add" className="text-xl" />
              Record payment
              <MaterialIcon icon="arrow_forward" className="ml-3 text-lg" />
            </Link>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-5 border-t border-white/15 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <p className="text-xs text-blue-100">{todayLabel}</p>
              <p className="mt-1 text-sm font-semibold">{school?.name}</p>
            </div>
            <dl className="grid !grid-cols-3 gap-2 sm:gap-4">
              {channels.map((channel) => (
                <div key={channel.label} className="min-w-0">
                  <MaterialIcon icon={channel.icon} className="mb-2 text-xl text-[#b8f2dc]" />
                  <dt className="text-xs text-blue-100">{channel.label}</dt>
                  <dd
                    title={formatCurrency(channel.amount)}
                    className="mt-1 break-words text-base font-bold tabular-nums sm:text-lg"
                  >
                    {paymentsLoading || paymentsError ? "—" : formatCompactCurrency(channel.amount, true)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-relaxed text-blue-100">
              {otherTakings > 0 && !paymentsError ? `Other channels: ${formatCurrency(otherTakings)}. ` : ""}
              Based on the receipts loaded here, not a reconciled daily total.
            </p>
          </div>
        </div>
      </section>

      <nav aria-label="Bursar quick actions" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {shortcuts.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex min-h-[84px] min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:p-4"
          >
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[var(--primary)] sm:flex">
              <MaterialIcon icon={action.icon} className="text-xl" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[var(--t1)]">{action.label}</span>
              <span className="mt-1 hidden text-xs text-[var(--t3)] sm:block">{action.hint}</span>
            </span>
            <MaterialIcon
              icon="arrow_outward"
              className="shrink-0 text-base text-[var(--t3)] group-hover:text-[var(--primary)]"
            />
          </Link>
        ))}
      </nav>

      {!hasCurrentTermFees && !feeStructureLoading && !feeStructureError && (
        <section
          aria-label="Fee setup needed"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <MaterialIcon icon="info" className="mt-0.5 shrink-0 text-xl text-amber-700" />
            <div>
              <h2 className="text-sm font-bold text-amber-950">
                {noFeesAtAll ? "Start by setting your fees" : `No fees set for Term ${currentTerm}, ${academicYear}`}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">
                Set the current term&apos;s charges before relying on collection progress. Figures below may include
                other fee items.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/fee-structure"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-950"
          >
            {noFeesAtAll ? "Set fees" : `Set Term ${currentTerm} fees`}
            <MaterialIcon icon="arrow_forward" className="text-base" />
          </Link>
        </section>
      )}

      <section aria-label="Fee summary" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--t1)]">Collection overview</h2>
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--t2)]">
            <MaterialIcon icon={isDemo ? "science" : feeSummary ? "database" : "info"} className="text-sm" />
            {sourceLabel}
          </span>
        </div>
        {!isDemo && !feeSummary && !feeSummaryLoading && (
          <p role="status" className="text-xs text-amber-800">
            {fallbackUnavailable
              ? "Some finance records could not be loaded. Summary values remain unknown until the data is available."
              : "School-wide totals are unavailable. Estimates use only loaded students, fee items and receipts; verify totals in finance reports."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Expected fees",
              value: formatCompactCurrency(totalFeesExpected, true),
              exact: formatCurrency(totalFeesExpected),
              hint: `${studentTotal} students`,
              icon: "account_balance",
              href: "/dashboard/fees",
              tone: "text-[var(--t1)]",
            },
            {
              label: "Fees collected",
              value: formatCompactCurrency(totalFeesCollected, true),
              exact: formatCurrency(totalFeesCollected),
              hint: "Recorded fee income",
              icon: "payments",
              href: "/dashboard/fee-ledger",
              tone: "text-[var(--green)]",
            },
            {
              label: "Outstanding",
              value: formatCompactCurrency(totalArrears, true),
              exact: formatCurrency(totalArrears),
              hint: `${overdueCount} students in arrears`,
              icon: "account_balance_wallet",
              href: "/dashboard/fees?status=unpaid",
              tone: "text-[var(--red)]",
            },
            {
              label: "Collection rate",
              value: totalFeesExpected > 0 ? `${collectionRate}%` : "—",
              exact: totalFeesExpected > 0 ? `${collectionRate}%` : "No expected fees",
              hint: totalFeesExpected > 0 ? "Of expected fee income" : "Set fees to see progress",
              icon: "percent",
              href: "/dashboard/reports",
              tone: "text-[var(--primary)]",
            },
          ].map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--t2)]">{metric.label}</p>
                <MaterialIcon icon={metric.icon} className="text-lg text-[var(--t3)]" />
              </div>
              <p
                title={metric.exact}
                className={`mt-3 break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${metric.tone}`}
              >
                {figuresReady ? metric.value : "—"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--t3)]">
                {figuresReady ? metric.hint : fallbackUnavailable ? "Summary unavailable" : "Loading summary…"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <BursarReceiptPanel
          payments={payments}
          students={students}
          loading={paymentsLoading}
          error={paymentsError}
          onRetry={() => void refetchPayments()}
        />
        <section
          aria-labelledby="arrears-follow-up-title"
          className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="arrears-follow-up-title" className="text-base font-bold text-[var(--t1)]">
              Arrears follow-up
            </h2>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {figuresReady ? overdueCount : "—"} accounts
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--t3)]">
            Largest balances in this summary. Review before contacting a parent.
          </p>
          <div className="my-4 rounded-xl bg-[var(--surface-container-low)] p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--t2)]">
              <span>Fees collected</span>
              <span className="font-bold">{figuresReady && totalFeesExpected > 0 ? `${collectionRate}%` : "—"}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Fee collection progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={figuresReady && totalFeesExpected > 0 ? Math.min(100, collectionRate) : undefined}
              aria-valuetext={
                figuresReady && totalFeesExpected > 0
                  ? `${collectionRate}% collected`
                  : "Collection progress unavailable"
              }
              className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]"
            >
              <div
                className="h-full rounded-full bg-[var(--green)]"
                style={{ width: `${figuresReady ? Math.min(100, collectionRate) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--t3)]">
              {figuresReady
                ? `${highRiskArrearsCount} balances of UGX ${HIGH_RISK_ARREARS_THRESHOLD.toLocaleString()} or more`
                : "Loading balances…"}
            </p>
          </div>
          {figuresReady && figures.defaulters.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {figures.defaulters.slice(0, 4).map((student) => {
                const name = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
                return (
                  <li key={student.student_id}>
                    <Link
                      href={`/dashboard/fees?status=unpaid&q=${encodeURIComponent(name)}`}
                      className="flex min-h-16 items-center gap-3 rounded-lg py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-800"
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
                        className="text-sm font-bold tabular-nums text-[var(--red)]"
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
              {figuresReady ? "No outstanding accounts in this summary." : "Loading accounts…"}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <Link
              href="/dashboard/fees?status=unpaid"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--on-primary)]"
            >
              View all arrears
              <MaterialIcon icon="arrow_forward" className="text-base" />
            </Link>
            <Link
              href="/dashboard/messages"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--t2)]"
            >
              <MaterialIcon icon="sms" className="text-base" />
              Send reminders
            </Link>
          </div>
        </section>
      </div>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <MoneyPositionStrip />
        <div className="min-w-0">
          {paymentsLoading || paymentsError ? (
            <section
              aria-label="Weekly collections"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <h2 className="text-sm font-bold text-[var(--t1)]">Collections this week</h2>
              <p className="mt-3 text-sm text-[var(--t3)]">
                {paymentsError
                  ? "Weekly activity is unavailable. Retry loading receipts above."
                  : "Loading receipt activity…"}
              </p>
            </section>
          ) : (
            <WeeklyCollections payments={payments} />
          )}
          <p className="mt-2 px-1 text-xs text-[var(--t3)]">
            Weekly activity uses the receipts loaded on this dashboard.
          </p>
        </div>
      </div>

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
