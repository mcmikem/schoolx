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
import { StatsGridSkeleton } from "@/components/Skeletons";

import StatCard from "@/components/dashboard/StatCard";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import ActionCenter from "@/components/dashboard/ActionCenter";
import SmartAdvisor from "@/components/dashboard/SmartAdvisor";

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

  return (
    <div className="content">
      <div className="relative overflow-hidden rounded-[var(--r2)] p-6 bg-motif border border-[var(--border)] mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="ph-title truncate !text-3xl">
              {greeting}, {user?.full_name?.split(" ")[0]}
            </div>
            <div className="ph-sub truncate !text-sm">
              Bursar · {school?.name} • {academicYear} Term {currentTerm}
            </div>
          </div>
          <div className="ph-actions">
            <Link href="/dashboard/reports" className="btn btn-ghost shadow-sm">
              <MaterialIcon icon="download" style={{ fontSize: "16px" }} />
              <span>Financial Report</span>
            </Link>
            <Link href="/dashboard/fees" className="btn btn-primary shadow-md">
              <MaterialIcon icon="add_card" style={{ fontSize: "16px" }} />
              <span>Record Payment</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-toolbar mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--t3)] mb-1">Finance status</div>
            <div className="text-lg font-bold text-[var(--t1)]">Cleaner collections view with faster visibility into cash, arrears, and target progress</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="dashboard-pill bg-emerald-50 text-emerald-700">UGX {formatCurrency(totalFeesCollected)} in</span>
            <span className="dashboard-pill bg-blue-50 text-blue-700">{collectionRate}% rate</span>
            <span className="dashboard-pill bg-amber-50 text-amber-700">UGX {formatCurrency(totalArrears)} due</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Collected"
          value={`UGX ${formatCurrency(totalFeesCollected)}`}
          subValue={`${collectionRate}% Collection Rate`}
          icon="account_balance"
          accentColor="green"
          variant="premium-navy"
          trend={{
            value: Math.abs(collectionTrend),
            direction: collectionTrend >= 0 ? "up" : "down",
            label: "vs last month",
          }}
        />
        <StatCard
          label="Total Arrears"
          value={`UGX ${formatCurrency(totalArrears)}`}
          subValue={`${students.length} pending`}
          icon="warning"
          accentColor="red"
          variant="premium-amber"
        />
        <StatCard
          label="Target"
          value={`UGX ${formatCurrency(totalFeesExpected)}`}
          subValue={`Term ${currentTerm} goal`}
          icon="calculate"
          accentColor="navy"
        />
      </div>

      <div className="mb-8">
        <SmartAdvisor
          stats={{
            totalFeesExpected,
            totalFeesCollected,
          }}
          collectionRate={collectionRate}
          attendanceRate={attendanceRate}
          role="bursar"
        />
      </div>

      {/* Visual Insights - hidden on mobile */}
      <div className="hidden xl:block grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
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

      {/* Action Hub */}
      <div className="mb-4 mt-8">
        <h3 className="text-sm font-bold text-[var(--t1)] mb-4 flex items-center gap-2">
          <MaterialIcon icon="bolt" className="text-[var(--amber)]" />
          Quick Financial Ops
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/fees" className="qa-item group">
            <div
              className="qa-icon"
              style={{ background: "var(--green-soft)", color: "var(--green)" }}
            >
              <MaterialIcon icon="add_card" />
            </div>
            <div className="mt-2">
              <div className="text-[14px] font-bold text-[var(--t1)]">
                Payments
              </div>
              <div className="text-[11px] text-[var(--t4)]">
                Record student fees
              </div>
            </div>
          </Link>
          <Link href="/dashboard/invoicing" className="qa-item group">
            <div
              className="qa-icon"
              style={{ background: "var(--navy-soft)", color: "var(--navy)" }}
            >
              <MaterialIcon icon="description" />
            </div>
            <div className="mt-2">
              <div className="text-[14px] font-bold text-[var(--t1)]">
                Invoicing
              </div>
              <div className="text-[11px] text-[var(--t4)]">Generate bills</div>
            </div>
          </Link>
          <Link href="/dashboard/cashbook" className="qa-item group">
            <div
              className="qa-icon"
              style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
            >
              <MaterialIcon icon="book" />
            </div>
            <div className="mt-2">
              <div className="text-[14px] font-bold text-[var(--t1)]">
                Cashbook
              </div>
              <div className="text-[11px] text-[var(--t4)]">Daily tracking</div>
            </div>
          </Link>
          <Link href="/dashboard/budget" className="qa-item group">
            <div
              className="qa-icon"
              style={{ background: "var(--blue-soft)", color: "var(--blue)" }}
            >
              <MaterialIcon icon="account_balance_wallet" />
            </div>
            <div className="mt-2">
              <div className="text-[14px] font-bold text-[var(--t1)]">
                Budgets
              </div>
              <div className="text-[11px] text-[var(--t4)]">Plan spending</div>
            </div>
          </Link>
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
