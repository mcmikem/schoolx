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

interface DashboardInsightsProps {
  stats: any;
  attendanceRate: number;
  collectionRate: number;
  students: any[];
  payments: any[];
  loading?: boolean;
}

export default function DashboardInsights({
  stats,
  attendanceRate,
  collectionRate,
  students,
  payments,
  loading,
}: DashboardInsightsProps) {
  // Generate dummy trend data for the area chart (last 6 months)
  // In a real app, this would come from an API
  const trendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    return months.map((month, i) => ({
      name: month,
      fees: 4000 + Math.random() * 2000 + i * 500,
      attendance: 85 + Math.random() * 10,
    }));
  }, []);

  // Student Demographics Data
  const demoData = useMemo(() => {
    const boys = students.filter((s) => s.gender === "M").length;
    const girls = students.filter((s) => s.gender === "F").length;
    return [
      { name: "Boys", value: boys || 50, color: "var(--navy)" },
      { name: "Girls", value: girls || 50, color: "var(--grad-teal)" },
    ];
  }, [students]);

  // School Health Score (Weighted average)
  const healthScore = useMemo(() => {
    if (loading) return 0;
    const attendanceWeight = 0.4;
    const feeWeight = 0.6;
    return Math.round(attendanceRate * attendanceWeight + collectionRate * feeWeight);
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
            <h3 className="text-sm font-bold text-[var(--t1)] font-heading">Performance Trends</h3>
            <p className="text-[11px] text-[var(--t3)] font-medium">Fee Collection vs Attendance (Projections)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--navy)]" />
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase">Fees</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--green)]" />
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase">Attendance</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--navy)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="var(--navy)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
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
                  fontWeight: "bold"
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
        </div>
      </div>

      {/* 2. Right Column Widgets */}
      <div className="flex flex-col gap-6">
        {/* School Health Gauge */}
        <div className="glass-premium rounded-[var(--r2)] p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-[var(--grad-teal)] opacity-20" />
          <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-widest mb-4">School Health</h3>
          
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
                <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--red)" />
                  <stop offset="50%" stopColor="var(--amber)" />
                  <stop offset="100%" stopColor="var(--green)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute bottom-2 flex flex-col items-center">
              <span className="text-3xl font-extrabold text-[var(--t1)] font-heading leading-none">{healthScore}%</span>
              <span className="text-[10px] font-bold text-[var(--green)] uppercase mt-1">Excellent</span>
            </div>
          </div>
          
          <div className="w-full mt-4 flex items-center justify-between px-2">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[var(--t3)] font-bold">Attendance</span>
              <span className="text-xs font-extrabold text-[var(--green)]">{attendanceRate}%</span>
            </div>
            <div className="w-[1px] h-6 bg-[var(--border)]" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[var(--t3)] font-bold">FEES</span>
              <span className="text-xs font-extrabold text-[var(--amber)]">{collectionRate}%</span>
            </div>
          </div>
        </div>

        {/* Demographics Doughnut */}
        <div className="glass-premium rounded-[var(--r2)] p-5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-widest">Demographics</h3>
            <MaterialIcon icon="groups" style={{ fontSize: 18, color: "var(--navy)" }} />
          </div>
          
          <div className="flex-1 flex items-center">
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
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-[var(--t2)]">{item.name}</span>
                  </div>
                  <span className="text-xs font-extrabold text-[var(--t1)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
