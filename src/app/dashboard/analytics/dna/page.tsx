"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudents } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

export default function PerformanceDNAPage() {
  const { school, isDemo } = useAuth();
  const { students } = useStudents(school?.id);
  const [searchStudent, setSearchStudent] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Filter students based on search
  const searchResults =
    searchStudent.length >= 2
      ? students
          .filter((s) =>
            `${s.first_name} ${s.last_name}`
              .toLowerCase()
              .includes(searchStudent.toLowerCase()),
          )
          .slice(0, 5)
      : [];

  // Generate DNA data for selected student
  const selectedDNAData = selectedStudent
    ? [
        { subject: "Academic", A: 70 + Math.random() * 30, fullMark: 100 },
        { subject: "Attendance", A: 85 + Math.random() * 15, fullMark: 100 },
        { subject: "Conduct", A: 75 + Math.random() * 25, fullMark: 100 },
        { subject: "Leadership", A: 60 + Math.random() * 40, fullMark: 100 },
        { subject: "Social", A: 65 + Math.random() * 35, fullMark: 100 },
        { subject: "Punctuality", A: 80 + Math.random() * 20, fullMark: 100 },
      ]
    : null;

  const mockDNAData = [
    { subject: "Academic", A: 85, fullMark: 100 },
    { subject: "Attendance", A: 98, fullMark: 100 },
    { subject: "Conduct", A: 90, fullMark: 100 },
    { subject: "Leadership", A: 70, fullMark: 100 },
    { subject: "Social", A: 65, fullMark: 100 },
    { subject: "Punctuality", A: 95, fullMark: 100 },
  ];

  const correlationData = [
    { week: "W1", grades: 78, conduct: 82, spending: 20000 },
    { week: "W2", grades: 82, conduct: 85, spending: 15000 },
    { week: "W3", grades: 75, conduct: 70, spending: 45000 },
    { week: "W4", grades: 88, conduct: 95, spending: 12000 },
  ];

  // Handle student selection
  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchStudent(`${student.first_name} ${student.last_name}`);
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
              <MaterialIcon icon="biotech" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Performance DNA
            </h1>
          </div>
          <p className="text-slate-500 font-medium tracking-tight">
            Holistic student correlation and character-academic mapping
          </p>
        </div>

        <div className="flex gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Select student to analyze..."
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-primary-100 min-w-[350px] shadow-sm"
            />
            <MaterialIcon
              icon="person_search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: DNA Visual */}
        <div className="lg:col-span-2 space-y-6">
          <div
            className={
              cardClassName +
              " p-8 flex flex-col items-center justify-center min-h-[450px]"
            }
          >
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8 text-center">
              Biometric Success Matrix
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="80%"
                data={mockDNAData}
              >
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 10, fontWeight: 800, fill: "#64748b" }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Student Success"
                  dataKey="A"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 w-full mt-6">
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase">
                  IQ Index
                </p>
                <p className="text-lg font-black text-slate-800">85/100</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase">
                  EQ Index
                </p>
                <p className="text-lg font-black text-slate-800">92/100</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase">
                  Growth
                </p>
                <p className="text-lg font-black text-emerald-500">+12%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Correlation Analysis */}
        <div className="lg:col-span-3 space-y-6">
          <div className={cardClassName + " p-6"}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                Welfare Correlation
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                  <span className="text-[10px] font-bold text-slate-500">
                    Grades
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-500">
                    Conduct
                  </span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={correlationData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{ fontWeight: 900, marginBottom: "4px" }}
                />
                <Line
                  type="monotone"
                  dataKey="grades"
                  stroke="#3b82f6"
                  strokeWidth={4}
                  dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="conduct"
                  stroke="#10b981"
                  strokeWidth={4}
                  strokeDasharray="8 5"
                  dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500 leading-relaxed">
              Analysis: This student shows a{" "}
              <strong>strong positive correlation</strong> (0.84) between
              conduct points and academic results. Improving classroom behavior
              likely precedes grade spikes.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={
                cardClassName +
                " p-6 bg-slate-900 border-none relative overflow-hidden"
              }
            >
              <MaterialIcon
                icon="bolt"
                className="absolute -right-4 -top-4 text-white/10"
                style={{ fontSize: 90 }}
              />
              <h4 className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2 relative z-10">
                AI Insight
              </h4>
              <p className="text-xs text-white/80 leading-relaxed font-medium relative z-10">
                Spending patterns peaked on Week 3 (UGX 45k) which coincided
                with a dip in grades. Possible correlation between canteen
                spending and study distraction.
              </p>
            </div>

            <div
              className={
                cardClassName + " p-6 border-indigo-100 bg-indigo-50/30"
              }
            >
              <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-3">
                Holistic Wellness
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">
                    Social Integration
                  </span>
                  <span className="text-xs font-black text-indigo-700">
                    65%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[65%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
