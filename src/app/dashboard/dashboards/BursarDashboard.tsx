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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#17325f]">{greeting}, {user?.full_name?.split(" ")[0]}</h1>
        <p className="text-sm text-[#6b7f99]">{school?.name} · {todayLabel}</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Expected</p>
          <p className="mt-1 text-xl font-bold text-[#17325f]">UGX {formatCurrency(totalFeesExpected)}</p>
        </div>
        <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Collected</p>
          <p className="mt-1 text-xl font-bold text-[#1f8a70]">UGX {formatCurrency(totalFeesCollected)}</p>
        </div>
        <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Arrears</p>
          <p className="mt-1 text-xl font-bold text-[#c2472b]">UGX {formatCurrency(totalArrears)}</p>
        </div>
        <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f91aa]">Collection rate</p>
          <p className={`mt-1 text-xl font-bold ${collectionRate >= 70 ? 'text-[#1f8a70]' : collectionRate >= 40 ? 'text-[#b45309]' : 'text-[#c2472b]'}`}>{collectionRate}%</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#d7e3f2] bg-white p-5 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#17325f]">Top defaulters</h2>
            <p className="text-xs text-[#6b7f99]">Students with largest fee gaps</p>
          </div>
          <a href="/dashboard/fees" className="rounded-full bg-[#ffefe8] px-3 py-1 text-[10px] font-bold text-[#c2472b]">All debtors</a>
        </div>
        <div className="space-y-2">
          {students.filter(s => {
            const paid = payments.filter(p => p.student_id === s.id).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
            const expected = feeStructure.filter(f => !f.class_id || f.class_id === s.class_id).reduce((sum, f) => sum + Number(f.amount || 0), 0);
            return paid < expected && expected > 0;
          }).slice(0, 6).map(student => {
            const paid = payments.filter(p => p.student_id === student.id).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
            const expected = feeStructure.filter(f => !f.class_id || f.class_id === student.class_id).reduce((sum, f) => sum + Number(f.amount || 0), 0);
            return (
              <div key={student.id} className="flex items-center gap-3 rounded-[14px] bg-[#fcfcfd] border border-[#eaedf2] px-3 py-2.5">
                <div className="h-8 w-8 rounded-full bg-[#ffefe8] flex items-center justify-center text-xs font-bold text-[#c2472b] shrink-0">
                  {(student.first_name?.[0] || '')}{(student.last_name?.[0] || '')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#17325f] truncate">{student.first_name} {student.last_name}</p>
                  <p className="text-[10px] text-[#7890ad]">{student.parent_name} · {(student as any).classes?.name || ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#c2472b]">UGX {formatCurrency(expected - paid)}</p>
                </div>
                {student.parent_phone && (
                  <div className="flex gap-1 shrink-0">
                    <a href={`tel:${student.parent_phone}`} className="rounded-lg bg-[#eef4fb] px-2 py-1.5 text-[#42638d] hover:bg-[#dce8f5]">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                    </a>
                    <a href={`/dashboard/messages?to=${student.parent_phone}`} className="rounded-lg bg-[#17325f] px-2 py-1.5 text-white hover:opacity-90">
                      <span className="material-symbols-outlined text-[14px]">sms</span>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#d7e3f2] bg-white p-5 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#17325f]">Recent payments</h2>
            <p className="text-xs text-[#6b7f99]">This month: UGX {formatCurrency(thisMonthTotal)}</p>
          </div>
          <a href="/dashboard/fees" className="rounded-full bg-[#eef4fb] px-3 py-1 text-[10px] font-semibold text-[#42638d]">All</a>
        </div>
        <div className="space-y-2">
          {payments.slice(0, 6).map((p: any) => {
            const student = students.find(s => s.id === p.student_id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-[12px] bg-[#f6f9fc] px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#e1f3ee] flex items-center justify-center text-xs font-bold text-[#1f8a70] shrink-0">
                  {student ? (student.first_name?.[0] || '') + (student.last_name?.[0] || '') : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#17325f] truncate">{student ? `${student.first_name} ${student.last_name}` : 'Unknown'}</p>
                  <p className="text-[10px] text-[#7890ad]">{new Date(p.payment_date).toLocaleDateString('en-UG')} · {p.payment_method || 'Cash'}</p>
                </div>
                <p className="text-sm font-bold text-[#1f8a70]">UGX {formatCurrency(p.amount_paid || p.amount || 0)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#d7e3f2] bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#b45309]">receipt</span>
            <h3 className="text-sm font-bold text-[#17325f]">Pending expenses</h3>
          </div>
          <p className="text-2xl font-bold text-[#b45309]">0</p>
          <p className="text-xs text-[#6b7f99] mt-1">Awaiting approval</p>
          <a href="/dashboard/expense-approvals" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#42638d] hover:underline">
            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            View
          </a>
        </div>
        <div className="rounded-2xl border border-[#d7e3f2] bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#17325f]">payroll</span>
            <h3 className="text-sm font-bold text-[#17325f]">Payroll</h3>
          </div>
          <p className="text-2xl font-bold text-[#17325f]">--</p>
          <p className="text-xs text-[#6b7f99] mt-1">Next run</p>
          <a href="/dashboard/payroll" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#42638d] hover:underline">
            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            View payroll
          </a>
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
