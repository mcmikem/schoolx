"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import {
  useStudents,
  useFeePayments,
  useFeeStructure,
} from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import ErrorBoundary from "@/components/ErrorBoundary";

import StatCard from "@/components/dashboard/StatCard";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import EcosystemPulse from "@/components/dashboard/EcosystemPulse";
import TopDefaulters from "@/components/dashboard/TopDefaulters";
import RecentPayments from "@/components/dashboard/RecentPayments";

function BursarDashboardContent() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { students } = useStudents(school?.id);
  const { payments } = useFeePayments(school?.id);
  const { feeStructure } = useFeeStructure(school?.id);

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

  const totalFeesExpected = useMemo(() => students.reduce((total, student) => {
    const classFees = feeStructure.filter(
      (f) => !f.class_id || f.class_id === student.class_id,
    );
    const studentExpected = classFees.reduce(
      (sum, f) => sum + Number(f.amount || 0),
      0,
    );
    return total + studentExpected;
  }, 0), [students, feeStructure]);

  const totalFeesCollected = useMemo(() => payments.reduce(
    (sum, p) => sum + Number(p.amount_paid || 0),
    0,
  ), [payments]);
  const totalArrears = useMemo(() => Math.max(0, totalFeesExpected - totalFeesCollected), [totalFeesExpected, totalFeesCollected]);
  const collectionRate = useMemo(() =>
    totalFeesExpected > 0
      ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
      : 0, [totalFeesExpected, totalFeesCollected]);

  const overdueCount = useMemo(() => {
    const studentExpectedMap: Record<string, number> = {};
    for (const student of students) {
      const classFees = feeStructure.filter(
        (f) => !f.class_id || f.class_id === student.class_id,
      );
      studentExpectedMap[student.id] = classFees.reduce(
        (sum, f) => sum + Number(f.amount || 0),
        0,
      );
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

  const thisMonthPayments = useMemo(() => payments.filter((p) => {
    const d = new Date(p.payment_date);
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }), [payments]);
  const lastMonthPayments = useMemo(() => payments.filter((p) => {
    const d = new Date(p.payment_date);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      d.getMonth() === lastMonth.getMonth() &&
      d.getFullYear() === lastMonth.getFullYear()
    );
  }), [payments]);
  const thisMonthTotal = useMemo(() => thisMonthPayments.reduce(
    (s, p) => s + Number(p.amount_paid || 0),
    0,
  ), [thisMonthPayments]);
  const lastMonthTotal = useMemo(() => lastMonthPayments.reduce(
    (s, p) => s + Number(p.amount_paid || 0),
    0,
  ), [lastMonthPayments]);
  const collectionTrend = useMemo(() =>
    lastMonthTotal > 0
      ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
      : 0, [thisMonthTotal, lastMonthTotal]);

  const highRiskArrearsCount = useMemo(() => {
    const studentExpectedMap: Record<string, number> = {};
    for (const student of students) {
      const classFees = feeStructure.filter(
        (f) => !f.class_id || f.class_id === student.class_id,
      );
      studentExpectedMap[student.id] = classFees.reduce(
        (sum, f) => sum + Number(f.amount || 0),
        0,
      );
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

  return (
    <div className="content">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#17325f] font-['Sora']">{greeting}, {user?.full_name?.split(" ")[0]}</h1>
        <p className="text-sm text-[#60748f]">{school?.name} · {todayLabel}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-[20px] bg-white border border-[#e5ecf4] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Expected</p>
          <p className="mt-1 text-2xl font-bold text-[#17325f]">UGX {formatCurrency(totalFeesExpected)}</p>
        </div>
        <div className="rounded-[20px] bg-white border border-[#e5ecf4] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Collected</p>
          <p className="mt-1 text-2xl font-bold text-[#1f8a70]">UGX {formatCurrency(totalFeesCollected)}</p>
        </div>
        <div className="rounded-[20px] bg-white border border-[#e5ecf4] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Arrears</p>
          <p className={`mt-1 text-2xl font-bold ${totalArrears > 0 ? 'text-[#c2472b]' : 'text-[#1f8a70]'}`}>UGX {formatCurrency(totalArrears)}</p>
        </div>
        <div className="rounded-[20px] bg-white border border-[#e5ecf4] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Rate</p>
          <p className={`mt-1 text-2xl font-bold ${collectionRate >= 70 ? 'text-[#1f8a70]' : collectionRate >= 40 ? 'text-[#b45309]' : 'text-[#c2472b]'}`}>{collectionRate}%</p>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-[22px] border border-[#e5ecf4] bg-white p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#7f91aa] font-bold">Today Actions</div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
            {todayActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-xl border border-[#e5ecf4] bg-[#f8fbff] p-3 hover:bg-[#edf4ff] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-[#17325f]">{action.icon}</span>
                <div className="text-xs font-bold text-[#17325f] mt-2">{action.label}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#e5ecf4] bg-white p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#7f91aa] font-bold">Exceptions First</div>
          <div className="space-y-3 mt-3">
            <div className={`rounded-xl border p-3 ${totalArrears > 0 ? "border-[#f5d0c5] bg-[#ffefe8]" : "border-[#d8efe7] bg-[#f3fbf8]"}`}>
              <div className="text-xs font-semibold text-[#17325f]">Collection gap</div>
              <div className={`text-sm font-bold mt-1 ${totalArrears > 0 ? "text-[#c2472b]" : "text-[#1f8a70]"}`}>
                {totalArrears > 0 ? `UGX ${totalArrears.toLocaleString()}` : "Target met"}
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${highRiskArrearsCount > 0 ? "border-[#f5deb3] bg-[#fff8eb]" : "border-[#e5ecf4] bg-[#f8fbff]"}`}>
              <div className="text-xs font-semibold text-[#17325f]">High-risk arrears</div>
              <div className="text-sm font-bold mt-1 text-[#17325f]">{highRiskArrearsCount} learner(s) above UGX 300,000</div>
            </div>
            <div className="rounded-xl border border-[#e5ecf4] bg-[#f8fbff] p-3">
              <div className="text-xs font-semibold text-[#17325f]">Students in arrears</div>
              <div className="text-sm font-bold mt-1 text-[#17325f]">{overdueCount} out of {students.length}</div>
            </div>
            <div className="rounded-xl border border-[#e5ecf4] bg-[#f8fbff] p-3">
              <div className="text-xs font-semibold text-[#17325f]">Month trend</div>
              <div className={`text-sm font-bold mt-1 ${collectionTrend >= 0 ? "text-[#1f8a70]" : "text-[#c2472b]"}`}>
                {collectionTrend >= 0 ? "+" : ""}{collectionTrend}% vs last month
              </div>
            </div>
          </div>
        </div>
      </section>

      <TopDefaulters students={students} feeStructure={feeStructure} payments={payments} />
      <RecentPayments payments={payments} students={students} thisMonthTotal={thisMonthTotal} />
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
