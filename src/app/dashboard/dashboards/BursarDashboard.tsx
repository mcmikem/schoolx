"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useStudents,
  useFeePayments,
  useFeeStructure,
  useDashboardStats,
} from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";

import StatCard from "@/components/dashboard/StatCard";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";

function BursarDashboardContent() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { payments } = useFeePayments(school?.id);
  const { feeStructure } = useFeeStructure(school?.id);
  const { stats } = useDashboardStats(school?.id);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return `${amount}`;
  };

  const currentDate = new Date();
  const greeting =
    currentDate.getHours() < 12
      ? "Good Morning"
      : currentDate.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";

  const totalFeesExpected = students.reduce((total, student) => {
    const classFees = feeStructure.filter(
      (f) => !f.class_id || f.class_id === student.class_id,
    );
    const studentExpected = classFees.reduce(
      (sum, f) => sum + Number(f.amount || 0),
      0,
    );
    return total + studentExpected;
  }, 0);

  const totalFeesCollected = payments.reduce(
    (sum, p) => sum + Number(p.amount_paid || 0),
    0,
  );
  const totalArrears = Math.max(0, totalFeesExpected - totalFeesCollected);
  const collectionRate =
    totalFeesExpected > 0
      ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
      : 0;

  const thisMonthPayments = payments.filter((p) => {
    const d = new Date(p.payment_date);
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const lastMonthPayments = payments.filter((p) => {
    const d = new Date(p.payment_date);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      d.getMonth() === lastMonth.getMonth() &&
      d.getFullYear() === lastMonth.getFullYear()
    );
  });
  const thisMonthTotal = thisMonthPayments.reduce(
    (s, p) => s + Number(p.amount_paid || 0),
    0,
  );
  const lastMonthTotal = lastMonthPayments.reduce(
    (s, p) => s + Number(p.amount_paid || 0),
    0,
  );
  const collectionTrend =
    lastMonthTotal > 0
      ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
      : 0;
  const attendanceRate =
    stats?.totalStudents > 0
      ? Math.round((stats.presentToday / stats.totalStudents) * 100)
      : 0;
  const todayLabel = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="content">
      <section className="relative mb-6 overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(130deg,#f8fbff_0%,#eff5ff_42%,#f9f9ff_100%)] p-4 shadow-[0_24px_62px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-[#b8e6ef]/30 blur-3xl" />
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-[#dbe7ff]/70 blur-3xl" />
        </div>

        <div className="relative z-10 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7f91aa]">
                  Bursar command desk
                </p>
                <h1 className="mt-2 font-['Sora'] text-3xl font-semibold tracking-[-0.04em] text-[#17325f]">
                  {greeting}, {user?.full_name?.split(" ")[0]}
                </h1>
                <p className="mt-2 text-sm text-[#60748f]">
                  {school?.name} · {academicYear} Term {currentTerm}
                </p>
              </div>
              <div className="rounded-full border border-[#d8e4f2] bg-[#f5f9ff] px-3 py-1 text-[11px] font-semibold text-[#516a88]">
                {todayLabel}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Collected"
                value={`UGX ${formatCurrency(totalFeesCollected)}`}
                subValue={`${collectionRate}% of target`}
                icon="account_balance"
                accentColor="green"
                trend={{
                  value: Math.abs(collectionTrend),
                  direction: collectionTrend >= 0 ? "up" : "down",
                  label: "vs last month",
                }}
              />
              <StatCard
                label="Arrears"
                value={`UGX ${formatCurrency(totalArrears)}`}
                subValue={`${students.length} students`}
                icon="warning"
                accentColor="amber"
              />
              <StatCard
                label="Target"
                value={`UGX ${formatCurrency(totalFeesExpected)}`}
                subValue={`Term ${currentTerm}`}
                icon="calculate"
                accentColor="navy"
              />
              <StatCard
                label="Attendance"
                value={`${attendanceRate}%`}
                subValue={`${stats?.presentToday || 0} present`}
                icon="groups"
                accentColor="purple"
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d8e3f3] bg-[linear-gradient(180deg,#17325f_0%,#254f80_100%)] p-5 text-white shadow-[0_24px_48px_rgba(23,50,95,0.25)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              Collection pulse
            </p>
            <h2 className="mt-2 font-['Sora'] text-2xl font-semibold tracking-[-0.04em]">
              Cashflow health
            </h2>
            <div className="mt-5 space-y-3">
              {[
                ["This month", thisMonthTotal],
                ["Last month", lastMonthTotal],
                ["Outstanding", totalArrears],
              ].map(([label, amount]) => (
                <div key={String(label)} className="rounded-[16px] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
                  <p className="mt-1 text-xl font-semibold">UGX {formatCurrency(Number(amount))}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/dashboard/fees" className="group rounded-[22px] border border-white/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--green-soft)] text-[var(--green)]">
              <MaterialIcon icon="add_card" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#17325f]">Payments</p>
            <p className="text-xs text-[#6c809b]">Record fees</p>
          </Link>
          <Link href="/dashboard/invoicing" className="group rounded-[22px] border border-white/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--navy-soft)] text-[var(--navy)]">
              <MaterialIcon icon="description" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#17325f]">Invoicing</p>
            <p className="text-xs text-[#6c809b]">Generate bills</p>
          </Link>
          <Link href="/dashboard/cashbook" className="group rounded-[22px] border border-white/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--amber-soft)] text-[var(--amber)]">
              <MaterialIcon icon="book" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#17325f]">Cashbook</p>
            <p className="text-xs text-[#6c809b]">Daily tracking</p>
          </Link>
          <Link href="/dashboard/budget" className="group rounded-[22px] border border-white/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4d5dd1]">
              <MaterialIcon icon="account_balance_wallet" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#17325f]">Budgets</p>
            <p className="text-xs text-[#6c809b]">Plan spending</p>
          </Link>
        </div>
      </section>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6">
        <div className="xl:col-span-3">
          <DashboardInsights
            stats={{
              totalStudents: students.length,
              feesBalance: totalArrears,
            }}
            attendanceRate={attendanceRate}
            collectionRate={collectionRate}
            students={students}
            payments={payments}
            isDemo={isDemo}
          />
        </div>
        <div className="xl:col-span-1">
          <EcosystemPulse payments={payments} />
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
