"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import MaterialIcon from "@/components/MaterialIcon";
import { useMemo } from "react";
import { buildDashboardTrendData } from "@/lib/dashboard-data";

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
  attendanceRate: number;
  collectionRate: number;
  students: DashboardStudent[];
  payments: unknown[];
  loading?: boolean;
  isDemo?: boolean;
}

export default function DashboardInsights({
  stats,
  attendanceRate,
  collectionRate,
  students,
  payments,
  loading,
  isDemo,
}: DashboardInsightsProps) {
  // Filter to active students only - match student hub
  const activeStudents = students.filter(
    (s) => s.status === "active" || !s.status,
  );

  const trendData = useMemo(
    () =>
      buildDashboardTrendData({
        stats,
        activeStudentsCount: activeStudents.length,
        payments: payments as any[],
        attendanceRate,
        isDemo,
      }),
    [stats, activeStudents.length, payments, attendanceRate, isDemo],
  );

  // Student Demographics Data - Use stats first, fallback to students array
  const demoData = useMemo(() => {
    // Use stats.totalStudents if available (represents real data)
    const totalFromStats = stats?.totalStudents || 0;

    if (totalFromStats > 0) {
      // Use actual data from stats - calculate gender from students array or estimate
      const boys = activeStudents.filter(
        (s) => s.gender === "M" || s.gender === "Male",
      ).length;
      const girls = activeStudents.filter(
        (s) => s.gender === "F" || s.gender === "Female",
      ).length;

      // If we have partial data from students array, scale proportionally
      const known = boys + girls;
      if (known > 0 && known < totalFromStats) {
        const boyRatio = boys / known;
        return [
          {
            name: "Boys",
            value: Math.round(totalFromStats * boyRatio),
            color: "var(--navy)",
          },
          {
            name: "Girls",
            value: Math.round(totalFromStats * (1 - boyRatio)),
            color: "var(--green)",
          },
        ];
      }
      // Otherwise show actual from array
      return [
        { name: "Boys", value: boys, color: "var(--navy)" },
        { name: "Girls", value: girls, color: "var(--green)" },
      ];
    }

    // Fallback to students array only
    const boys = activeStudents.filter(
      (s) => s.gender === "M" || s.gender === "Male",
    ).length;
    const girls = activeStudents.filter(
      (s) => s.gender === "F" || s.gender === "Female",
    ).length;

    const results = [
      { name: "Boys", value: boys || 0, color: "var(--navy)" },
      { name: "Girls", value: girls || 0, color: "var(--green)" },
    ];

    // Only show fallback data in Demo Mode
    if (activeStudents.length === 0 && totalFromStats === 0) {
      if (isDemo) {
        return [
          { name: "Boys", value: 50, color: "var(--navy)" },
          { name: "Girls", value: 50, color: "var(--green)" },
        ];
      } else {
        return [
          { name: "Boys", value: 0, color: "var(--navy)" },
          { name: "Girls", value: 0, color: "var(--green)" },
        ];
      }
    }

    return results;
  }, [activeStudents, isDemo, stats?.totalStudents]);

  // School Health Score (Weighted average)
  const healthScore = useMemo(() => {
    if (loading) return 0;
    const attendanceWeight = 0.4;
    const feeWeight = 0.6;
    return Math.round(
      attendanceRate * attendanceWeight + collectionRate * feeWeight,
    );
  }, [attendanceRate, collectionRate, loading]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 h-[350px] bg-surface-container-low rounded-3xl" />
        <div className="h-[350px] bg-surface-container-low rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* 1. Performance Trends Area Chart */}
      <div className="lg:col-span-2 glass-premium rounded-[var(--r2)] p-6 flex flex-col gap-4 min-h-[350px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--t1)] font-heading">
              Fees & Attendance Tracker
            </h3>
            <p className="text-[11px] text-[var(--t3)] font-medium">
              How money and attendance changed this year
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--navy)]" />
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase">
                Fees
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--green)]" />
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase">
                Attendance
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 mt-2 relative">
          {!isDemo &&
          trendData.every((d) => d.fees === 0 && d.attendance == null) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[var(--bg)]/50 backdrop-blur-sm rounded-xl border border-dashed border-[var(--border)]">
              <MaterialIcon
                icon="analytics"
                style={{ fontSize: 40, color: "var(--t4)", opacity: 0.5 }}
              />
              <div className="mt-2 text-sm font-bold text-[var(--t2)]">
                No Activity Data Yet
              </div>
              <p className="text-[11px] text-[var(--t4)] max-w-[200px]">
                Once you start recording attendance and fees, your performance
                trends will appear here.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--navy)"
                      stopOpacity={0.1}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--navy)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--green)"
                      stopOpacity={0.1}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--green)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--t3)", fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "var(--sh3)",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="fees"
                  stroke="var(--navy)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorFees)"
                />
                <Area
                  type="monotone"
                  dataKey="attendance"
                  stroke="var(--green)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAtt)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. Right Column Widgets */}
      <div className="flex flex-col gap-6">
        {/* School Health Gauge */}
        <div className="glass-premium rounded-[var(--r2)] p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-[var(--grad-teal)] opacity-20" />
          <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-widest mb-4">
            Total School Status
          </h3>

          <div className="relative w-40 h-28 flex items-center justify-center">
            <svg viewBox="0 0 100 60" className="w-full h-full">
              {/* Gauge Track */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="var(--border)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Gauge Fill */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="url(#gauge-grad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 125.6} 125.6`}
                style={{ transition: "stroke-dasharray 1s ease-out" }}
              />
              <defs>
                <linearGradient
                  id="gauge-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="var(--red)" />
                  <stop offset="50%" stopColor="var(--amber)" />
                  <stop offset="100%" stopColor="var(--green)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute bottom-2 flex flex-col items-center">
              <span className="text-3xl font-extrabold text-[var(--t1)] font-heading leading-none">
                {healthScore}%
              </span>
              <span className="text-[10px] font-bold text-[var(--green)] uppercase mt-1">
                Doing Well
              </span>
            </div>
          </div>

          <div className="w-full mt-4 flex items-center justify-between px-2">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[var(--t3)] font-bold">
                Attendance
              </span>
              <span className="text-xs font-extrabold text-[var(--green)]">
                {attendanceRate}%
              </span>
            </div>
            <div className="w-[1px] h-6 bg-[var(--border)]" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[var(--t3)] font-bold">
                FEES
              </span>
              <span className="text-xs font-extrabold text-[var(--amber)]">
                {collectionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Demographics Doughnut */}
        <div className="glass-premium rounded-[var(--r2)] p-5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-widest">
              Student Summary
            </h3>
            <MaterialIcon
              icon="groups"
              style={{ fontSize: 18, color: "var(--navy)" }}
            />
          </div>

          <div className="flex-1 flex items-center relative">
            {!isDemo && activeStudents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <MaterialIcon
                  icon="person_off"
                  style={{ fontSize: 32, color: "var(--t4)", opacity: 0.5 }}
                />
                <div className="mt-1 text-xs font-bold text-[var(--t2)]">
                  No Students
                </div>
                <p className="text-[10px] text-[var(--t4)] max-w-[150px]">
                  Enroll students to see breakdown.
                </p>
              </div>
            ) : (
              <>
                <div className="w-24 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demoData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {demoData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 flex flex-col gap-2 ml-4">
                  {demoData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-bold text-[var(--t2)]">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-[var(--t1)]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Financial Realization Widget */}
        <div className="glass-premium rounded-[var(--r2)] p-5 flex flex-col items-center justify-between border-t-4 border-t-[var(--amber)]">
          <div className="w-full flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-widest">
              Revenue Forecast
            </h3>
            <MaterialIcon
              icon="trending_up"
              className="text-[var(--amber)] text-lg"
            />
          </div>

          <div className="w-full space-y-3">
            <div>
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="text-[var(--t2)] tracking-tight">
                  Realized vs Goal
                </span>
                <span className="text-[var(--amber)]">{collectionRate}%</span>
              </div>
              <div className="h-2 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-motif-amber animate-pulse-slow transition-all duration-1000"
                  style={{
                    width: `${collectionRate}%`,
                    background: "var(--grad-amber)",
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[var(--t3)] font-bold uppercase">
                Balance to Collect
              </span>
              <span className="text-lg font-heading text-[var(--t1)]">
                UGX {(stats?.feesBalance || 0).toLocaleString()}
              </span>
              <p className="text-[9px] text-[var(--t4)] font-medium leading-tight">
                Based on current enrollment and assigned fee structures.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
