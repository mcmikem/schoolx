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
      <div className="grid grid-cols-4 gap-3 mb-6">
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
