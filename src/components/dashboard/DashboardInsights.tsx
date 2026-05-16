"use client";
import dynamic from "next/dynamic";

interface DashboardStats {
  totalStudents?: number;
  feesBalance?: number;
}

interface DashboardStudent {
  status?: string | null;
  gender?: string | null;
}

interface DashboardInsightsProps {
  stats: DashboardStats | null;
  attendanceRate?: number;
  collectionRate: number;
  students: DashboardStudent[];
  payments: unknown[];
  loading?: boolean;
  isDemo?: boolean;
}

const DashboardInsightsCharts = dynamic(
  () => import("./DashboardInsightsCharts"),
  { ssr: false },
);

export default function DashboardInsights({
  stats,
  attendanceRate = 0,
  collectionRate,
  students,
  payments,
  loading,
  isDemo,
}: DashboardInsightsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 h-[350px] bg-[var(--surface-container-low)] rounded-3xl" />
        <div className="h-[350px] bg-[var(--surface-container-low)] rounded-3xl" />
      </div>
    );
  }

  return (
    <DashboardInsightsCharts
      stats={stats}
      attendanceRate={attendanceRate}
      collectionRate={collectionRate}
      students={students}
      payments={payments}
      isDemo={isDemo}
      loading={loading}
    />
  );
}