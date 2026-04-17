"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudents } from "@/lib/hooks";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const CONDUCT_PENALTY_PER_POINT = 5;

interface StudentDNA {
  academic: number;
  attendance: number;
  conduct: number;
  punctuality: number;
  gradesCount: number;
  attendanceCount: number;
  conductPoints: number;
  lateCount: number;
}

export default function PerformanceDNAPage() {
  const { school } = useAuth();
  const { currentTerm, academicYear } = useAcademic();
  const { students } = useStudents(school?.id);
  const [searchStudent, setSearchStudent] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [dnaData, setDnaData] = useState<StudentDNA | null>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loadingDNA, setLoadingDNA] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter students based on search
  const searchResults =
    searchStudent.length >= 2
      ? students
          .filter((s) =>
            `${s.first_name} ${s.last_name}`
              .toLowerCase()
              .includes(searchStudent.toLowerCase()),
          )
          .slice(0, 8)
      : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load real DNA data when a student is selected
  useEffect(() => {
    if (!selectedStudent || !school?.id) return;
    setLoadingDNA(true);

    async function loadDNA() {
      try {
        const studentId = selectedStudent.id;

        // Grades: average score as percentage of max
        const { data: grades } = await supabase
          .from("grades")
          .select("score, max_score, created_at")
          .eq("student_id", studentId)
          .eq("school_id", school!.id)
          .eq("term", currentTerm);

        let academic = 0;
        let gradesCount = grades?.length ?? 0;
        if (gradesCount > 0) {
          const totalPct = grades!.reduce(
            (sum, g) =>
              sum + (g.max_score > 0 ? (g.score / g.max_score) * 100 : 0),
            0,
          );
          academic = Math.round(totalPct / gradesCount);
        }

        // Attendance: present% and late count
        const { data: attendance } = await supabase
          .from("attendance")
          .select("status, date")
          .eq("student_id", studentId)
          .eq("school_id", school!.id);

        const total = attendance?.length ?? 0;
        const presentCount =
          attendance?.filter((a) => a.status === "present").length ?? 0;
        const lateCount =
          attendance?.filter((a) => a.status === "late").length ?? 0;
        const attendancePct =
          total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
        const punctualityPct =
          total > 0
            ? Math.round(((total - lateCount) / total) * 100)
            : 0;

        // Conduct points (behaviour logs)
        const { data: conduct } = await supabase
          .from("behaviour_logs")
          .select("points, created_at")
          .eq("student_id", studentId)
          .eq("school_id", school!.id);

        const conductPoints = conduct?.reduce((s, b) => s + (b.points ?? 0), 0) ?? 0;
        // Scale conduct to 0-100 (100 = no incidents, subtract 5 per negative point)
        const conductScore = Math.max(
          0,
          Math.min(
            100,
            100 - Math.abs(conductPoints) * CONDUCT_PENALTY_PER_POINT,
          ),
        );

        setDnaData({
          academic,
          attendance: attendancePct,
          conduct: conductScore,
          punctuality: punctualityPct,
          gradesCount,
          attendanceCount: total,
          conductPoints,
          lateCount,
        });

        // Build weekly trend: last 8 weeks of grades vs attendance
        const now = new Date();
        const weeks: { week: string; grades: number; attendance: number }[] = [];
        for (let i = 7; i >= 0; i--) {
          const weekEnd = new Date(now);
          weekEnd.setDate(now.getDate() - i * 7);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekEnd.getDate() - 6);
          const label = `W${8 - i}`;

          const weekGrades = grades?.filter((g) => {
            const d = new Date(g.created_at);
            return d >= weekStart && d <= weekEnd;
          }) ?? [];
          const avgGrade =
            weekGrades.length > 0
              ? Math.round(
                  weekGrades.reduce(
                    (s, g) =>
                      s + (g.max_score > 0 ? (g.score / g.max_score) * 100 : 0),
                    0,
                  ) / weekGrades.length,
                )
              : null;

          const weekAtt = attendance?.filter((a) => {
            const d = new Date(a.date);
            return d >= weekStart && d <= weekEnd;
          }) ?? [];
          const attPct =
            weekAtt.length > 0
              ? Math.round(
                  (weekAtt.filter(
                    (a) => a.status === "present" || a.status === "late",
                  ).length /
                    weekAtt.length) *
                    100,
                )
              : null;

          if (avgGrade !== null || attPct !== null) {
            weeks.push({
              week: label,
              grades: avgGrade ?? 0,
              attendance: attPct ?? 0,
            });
          }
        }
        setWeeklyData(weeks);
      } catch {
        // Silently ignore - empty state is shown
      } finally {
        setLoadingDNA(false);
      }
    }

    loadDNA();
  }, [selectedStudent, school, currentTerm]);

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchStudent(`${student.first_name} ${student.last_name}`);
    setSearchOpen(false);
    setDnaData(null);
    setWeeklyData([]);
  };

  const radarData = dnaData
    ? [
        { subject: "Academic", A: dnaData.academic, fullMark: 100 },
        { subject: "Attendance", A: dnaData.attendance, fullMark: 100 },
        { subject: "Conduct", A: dnaData.conduct, fullMark: 100 },
        { subject: "Punctuality", A: dnaData.punctuality, fullMark: 100 },
      ]
    : null;

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end flex-wrap gap-4">
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

        {/* Search input — connected to state */}
        <div className="flex gap-4">
          <div className="relative" ref={searchRef}>
            <input
              type="text"
              value={searchStudent}
              onChange={(e) => {
                setSearchStudent(e.target.value);
                setSearchOpen(true);
                if (!e.target.value) {
                  setSelectedStudent(null);
                  setDnaData(null);
                  setWeeklyData([]);
                }
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search student to analyze..."
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-primary-100 min-w-[280px] sm:min-w-[350px] shadow-sm"
            />
            <MaterialIcon
              icon="person_search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-slate-200 z-50 overflow-hidden">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectStudent(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-100 last:border-0 flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-700 flex-shrink-0">
                      {s.first_name?.[0]}
                    </div>
                    {s.first_name} {s.last_name}
                    <span className="ml-auto text-[10px] text-slate-400">{s.student_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty state — no student selected */}
      {!selectedStudent && (
        <div className={cardClassName + " p-16 flex flex-col items-center justify-center text-center"}>
          <MaterialIcon icon="person_search" className="text-slate-300 mb-4" style={{ fontSize: 64 }} />
          <h3 className="text-lg font-black text-slate-400 mb-2">Select a student to analyse</h3>
          <p className="text-sm text-slate-400">
            Type at least 2 characters in the search box above to find a student.
          </p>
        </div>
      )}

      {/* Loading state */}
      {selectedStudent && loadingDNA && (
        <div className={cardClassName + " p-16 flex flex-col items-center justify-center"}>
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-400">Loading performance data…</p>
        </div>
      )}

      {/* Data loaded — show charts */}
      {selectedStudent && !loadingDNA && dnaData && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: DNA Radar */}
          <div className="lg:col-span-2 space-y-6">
            <div
              className={
                cardClassName +
                " p-8 flex flex-col items-center justify-center min-h-[450px]"
              }
            >
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                Biometric Success Matrix
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                {selectedStudent.first_name} {selectedStudent.last_name}
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  data={radarData!}
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
                    name="Student"
                    dataKey="A"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 w-full mt-4">
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Academic Avg</p>
                  <p className="text-lg font-black text-slate-800">{dnaData.academic}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Attendance</p>
                  <p className="text-lg font-black text-slate-800">{dnaData.attendance}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Conduct</p>
                  <p className={`text-lg font-black ${dnaData.conduct >= 80 ? "text-emerald-500" : dnaData.conduct >= 60 ? "text-amber-500" : "text-red-500"}`}>
                    {dnaData.conduct}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Punctuality</p>
                  <p className="text-lg font-black text-slate-800">{dnaData.punctuality}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Weekly Trend */}
          <div className="lg:col-span-3 space-y-6">
            <div className={cardClassName + " p-6"}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                  Weekly Trend
                </h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-500">Grades</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-500">Attendance</span>
                  </div>
                </div>
              </div>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      labelStyle={{ fontWeight: 900 }}
                      formatter={(v: any, name: any) => [`${v}%`, name === "grades" ? "Grades" : "Attendance"] as [string, string]}
                    />
                    <Line type="monotone" dataKey="grades" stroke="#6366f1" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">
                  No weekly data available for this term yet.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={cardClassName + " p-6 bg-slate-900 border-none relative overflow-hidden"}>
                <MaterialIcon icon="analytics" className="absolute -right-4 -top-4 text-white/10" style={{ fontSize: 90 }} />
                <h4 className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2 relative z-10">Summary</h4>
                <div className="space-y-1.5 relative z-10">
                  <p className="text-xs text-white/80 font-medium">{dnaData.gradesCount} grade{dnaData.gradesCount !== 1 ? "s" : ""} recorded this term</p>
                  <p className="text-xs text-white/80 font-medium">{dnaData.attendanceCount} attendance records</p>
                  {dnaData.lateCount > 0 && (
                    <p className="text-xs text-amber-300 font-medium">{dnaData.lateCount} late arrival{dnaData.lateCount !== 1 ? "s" : ""}</p>
                  )}
                  {dnaData.conductPoints !== 0 && (
                    <p className={`text-xs font-medium ${dnaData.conductPoints < 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {dnaData.conductPoints > 0 ? "+" : ""}{dnaData.conductPoints} conduct points
                    </p>
                  )}
                </div>
              </div>

              <div className={cardClassName + " p-6 border-indigo-100 bg-indigo-50/30"}>
                <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-3">Wellness Overview</h4>
                <div className="space-y-3">
                  {[
                    { label: "Academic Performance", value: dnaData.academic, color: "bg-indigo-500" },
                    { label: "Attendance Rate", value: dnaData.attendance, color: "bg-emerald-500" },
                    { label: "Conduct Score", value: dnaData.conduct, color: dnaData.conduct >= 80 ? "bg-emerald-500" : dnaData.conduct >= 60 ? "bg-amber-500" : "bg-red-500" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-600">{item.label}</span>
                        <span className="text-xs font-black text-indigo-700">{item.value}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student selected but no data */}
      {selectedStudent && !loadingDNA && !dnaData && (
        <div className={cardClassName + " p-16 flex flex-col items-center justify-center text-center"}>
          <MaterialIcon icon="bar_chart" className="text-slate-300 mb-4" style={{ fontSize: 64 }} />
          <h3 className="text-lg font-black text-slate-400 mb-2">No data yet</h3>
          <p className="text-sm text-slate-400">
            No grades, attendance, or conduct records found for{" "}
            <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong> this term.
          </p>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
