"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Droplets,
  IdCard,
  GraduationCap,
  ClipboardCheck,
  FileText,
  CreditCard,
  MoreHorizontal,
  TrendingUp,
  Edit,
  Printer,
  Home,
  Moon,
  Trophy,
  School,
  Star,
  Award,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { useStudent } from "@/lib/hooks";
import { SendSMSModal } from "@/components/SendSMSModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type AttendanceRecord = {
  status: "present" | "absent" | "late";
  date?: string | null;
};

type GradeRecord = {
  subject: string | null;
  score: number | null;
  term: string | null;
};

function useStudentData(studentId: string, isDemo: boolean) {
  const [attendancePct, setAttendancePct] = useState(0);
  const [feePosition, setFeePosition] = useState({ paid: 0, total: 0 });
  const [gradeHistory, setGradeHistory] = useState<
    { term: string; average: number }[]
  >([]);
  const [subjectScores, setSubjectScores] = useState<
    { subject: string; score: number }[]
  >([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(
    [],
  );
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;

    if (isDemo) {
      setAttendancePct(82);
      setFeePosition({ paid: 850000, total: 1200000 });
      setGradeHistory([
        { term: "Term 1 2025", average: 75 },
        { term: "Term 2 2025", average: 80 },
        { term: "Term 3 2025", average: 85 },
      ]);
      setSubjectScores([
        { subject: "Math", score: 88 },
        { subject: "English", score: 92 },
        { subject: "Science", score: 12 },
        { subject: "SST", score: 68 },
      ]);
      setAttendanceRecords([]);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDetails() {
      try {
        setDetailsLoading(true);
        setDetailsError(null);

        const [
          { data: attData, error: attendanceError },
          { data: feeData, error: feeError },
          { data: gradesData, error: gradesError },
        ] = await Promise.all([
          supabase
            .from("attendance")
            .select("status, date")
            .eq("student_id", studentId),
          supabase
            .from("student_fees")
            .select("amount_paid, total_fees")
            .eq("student_id", studentId)
            .maybeSingle(),
          supabase
            .from("grades")
            .select("subject, score, term")
            .eq("student_id", studentId),
        ]);

        if (attendanceError) throw attendanceError;
        if (feeError) throw feeError;
        if (gradesError) throw gradesError;
        if (cancelled) return;

        const safeAttendance = (attData || []) as AttendanceRecord[];
        const present = safeAttendance.filter(
          (record) => record.status === "present",
        ).length;
        setAttendancePct(
          safeAttendance.length > 0
            ? Math.round((present / safeAttendance.length) * 100)
            : 0,
        );
        setAttendanceRecords(safeAttendance);

        setFeePosition({
          paid: Number(feeData?.amount_paid || 0),
          total: Number(feeData?.total_fees || 0),
        });

        const safeGrades = (gradesData || []) as GradeRecord[];
        setSubjectScores(
          safeGrades
            .filter(
              (grade): grade is GradeRecord & { subject: string; score: number } =>
                typeof grade.subject === "string" &&
                typeof grade.score === "number",
            )
            .map((grade) => ({
              subject: grade.subject,
              score: grade.score,
            })),
        );

        if (safeGrades.length > 0) {
          const validScores = safeGrades
            .map((grade) => Number(grade.score ?? 0))
            .filter((score) => Number.isFinite(score));
          setGradeHistory(
            validScores.length > 0
              ? [
                  {
                    term: "Current",
                    average: Math.round(
                      validScores.reduce((sum, score) => sum + score, 0) /
                        validScores.length,
                    ),
                  },
                ]
              : [],
          );
        } else {
          setGradeHistory([]);
        }
      } catch (error) {
        if (!cancelled) {
          setDetailsError(
            error instanceof Error
              ? error.message
              : "Unable to load student analytics",
          );
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    }

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [studentId, isDemo]);

  return {
    attendancePct,
    feePosition,
    gradeHistory,
    subjectScores,
    attendanceRecords,
    detailsLoading,
    detailsError,
  };
}

function AttendanceRing({ percentage }: { percentage: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    percentage >= 80
      ? "var(--green)"
      : percentage >= 60
        ? "var(--amber)"
        : "var(--red)";

  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="88" className="ring-svg">
        <circle className="ring-track" cx="44" cy="44" r={radius} />
        <circle
          className="ring-fill"
          cx="44"
          cy="44"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="-mt-14 text-center">
        <div className="text-lg font-extrabold text-[var(--t1)]">
          {percentage}%
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">
          Attendance
        </div>
      </div>
    </div>
  );
}

function AttendanceHeatmap({
  records,
  isDemo,
}: {
  records: AttendanceRecord[];
  isDemo: boolean;
}) {
  const days = useMemo(() => {
    if (isDemo) {
      const result: { status: "present" | "absent" | "late"; date: Date }[] =
        [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0) continue;
        const rand = Math.random();
        result.push({
          date: d,
          status: rand > 0.2 ? "present" : rand > 0.08 ? "late" : "absent",
        });
      }
      return result;
    }

    return records
      .slice(-30)
      .map((record) => {
        const parsedDate = record.date ? new Date(record.date) : new Date();
        return {
          date: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
          status: record.status,
        };
      });
  }, [records, isDemo]);

  const colorMap = {
    present: "bg-emerald-400 dark:bg-emerald-500",
    absent: "bg-red-400 dark:bg-red-500",
    late: "bg-amber-400 dark:bg-amber-500",
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={`w-full aspect-square rounded-sm ${colorMap[d.status]}`}
            title={`${d.date.toLocaleDateString()}: ${d.status}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--t3)] font-medium">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-400" /> Present
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-amber-400" /> Late
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-400" /> Absent
        </span>
      </div>
    </div>
  );
}

function FeeProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 100;
  const balance = total - paid;
  const isPaid = balance <= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[var(--t1)]">
          {isPaid
            ? "Fully Paid"
            : `UGX ${balance.toLocaleString()} outstanding`}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isPaid
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 bg-[var(--bg)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isPaid ? "bg-emerald-500" : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-[var(--t3)]">
        <span>Paid: UGX {paid.toLocaleString()}</span>
        <span>Total: UGX {total.toLocaleString()}</span>
      </div>
    </div>
  );
}

function GradeSparkline({
  data,
}: {
  data: { term: string; average: number }[];
}) {
  const width = 120;
  const height = 40;
  const padding = 4;
  const maxVal = 100;
  const minVal = Math.max(0, Math.min(...data.map((d) => d.average)) - 10);
  const range = maxVal - minVal || 1;
  const denominator = Math.max(1, data.length - 1);

  const points = data.map((d, i) => {
    const x = padding + (i / denominator) * (width - padding * 2);
    const y =
      height -
      padding -
      ((d.average - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const lastVal = data[data.length - 1].average;
  const prevVal = data.length > 1 ? data[data.length - 2].average : lastVal;
  const trend = lastVal >= prevVal;

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke={trend ? "var(--green)" : "var(--red)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(" ")}
        />
        {data.map((d, i) => {
          const x = padding + (i / denominator) * (width - padding * 2);
          const y =
            height -
            padding -
            ((d.average - minVal) / range) * (height - padding * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === data.length - 1 ? 3 : 1.5}
              fill={trend ? "var(--green)" : "var(--red)"}
            />
          );
        })}
      </svg>
      <div>
        <div
          className={`text-lg font-extrabold ${
            trend ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {lastVal}%
        </div>
        <div className="flex items-center gap-0.5 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">
          {trend ? (
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          ) : (
            <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />
          )}
          {trend ? "Improving" : "Declining"}
        </div>
      </div>
    </div>
  );
}

function getStatusConfig(status: string) {
  const s = (status || "active").toLowerCase();
  if (s === "active" || s === "enrolled")
    return {
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-500",
      label: "Active",
    };
  if (s === "dropout" || s === "withdrawn")
    return {
      bg: "bg-red-50 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
      dot: "bg-red-500",
      label: "Dropout",
    };
  if (s === "repeating" || s === "repeated")
    return {
      bg: "bg-amber-50 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
      dot: "bg-amber-500",
      label: "Repeating",
    };
  if (s === "suspended")
    return {
      bg: "bg-orange-50 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800",
      dot: "bg-orange-500",
      label: "Suspended",
    };
  if (s === "graduated" || s === "completed")
    return {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      dot: "bg-blue-500",
      label: "Graduated",
    };
  return {
    bg: "bg-gray-50 dark:bg-gray-800/50",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-700",
    dot: "bg-gray-400",
    label: status || "Unknown",
  };
}

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { isDemo } = useAuth();
  const { student, loading: studentLoading, error } = useStudent(
    resolvedParams.id,
  );
  const studentProfile = useMemo(
    () =>
      student
        ? {
            id: student.id,
            school_id: student.school_id,
            class_id: student.class_id,
            opening_balance: student.opening_balance,
          }
        : null,
    [student],
  );

  const studentId = studentProfile?.id || "";

  const {
    attendancePct,
    feePosition,
    gradeHistory,
    subjectScores,
    attendanceRecords,
    detailsLoading,
    detailsError,
  } = useStudentData(studentId, isDemo);

  const [activeTab, setActiveTab] = useState("overview");
  const [smsOpen, setSmsOpen] = useState(false);

  if (studentLoading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );

  if (error || !student)
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 dark:text-red-400 mb-4">
          Student not found
        </div>
        <Link href="/dashboard/students" className="btn btn-primary">
          Back to Students
        </Link>
      </div>
    );

  const statusCfg = getStatusConfig(student.status);
  const classLabel = student.classes?.name
    ? `${student.classes.name}${student.classes?.stream ? ` ${student.classes.stream}` : ""}`
    : "N/A";

  return (
    <PageErrorBoundary>
      <div>
      {detailsError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Some student analytics could not be loaded: {detailsError}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3 flex-1">
          <Link
            href="/dashboard/students"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Student Profile
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              View and manage student details
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setSmsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            SMS Parent
          </button>
          <Link
            href={`/dashboard/students/id-cards?studentId=${student.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <IdCard className="w-4 h-4" />
            Print ID
          </Link>
          <Link
            href={`/dashboard/students/admission-package?studentId=${student.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Admission Letter
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
        {/* Cover */}
        <div className="h-32 bg-gradient-to-r from-primary-700 to-primary-500 relative">
          <div className="absolute inset-0 bg-black/5" />
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
            {/* Photo */}
            <div className="relative">
              <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/50 rounded-full border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center">
                {student.photo_url ? (
                  <Image
                    src={student.photo_url}
                    alt={`${student.first_name || "Student"} ${student.last_name || ""}`}
                    width={96}
                    height={96}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-primary-700 dark:text-primary-300">
                    {student.first_name?.[0] || "?"}
                    {student.last_name?.[0] || "?"}
                  </span>
                )}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 ${statusCfg.dot}`}
              />
            </div>

            {/* Name & Details */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {student.first_name || "Unknown"}{" "}
                  {student.last_name || "Student"}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}
                  />
                  {statusCfg.label}
                </span>
                {student.houses && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border"
                    style={{
                      backgroundColor: `${student.houses.color}15`,
                      color: student.houses.color,
                      borderColor: `${student.houses.color}30`,
                    }}
                  >
                    <Home className="w-3 h-3" />
                    {student.houses.name} House
                  </span>
                )}
                {student.prefect_role && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-amber-200 bg-amber-50 text-amber-700">
                    <Trophy className="w-3 h-3" />
                    {student.prefect_role.replace(/_/g, " ")}
                  </span>
                )}
                {student.student_council_role && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-blue-200 bg-blue-50 text-blue-700">
                    <Star className="w-3 h-3" />
                    Council: {student.student_council_role.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <IdCard className="w-4 h-4" /> {student.student_number}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" /> {classLabel}
                </span>
                <span className="flex items-center gap-1 uppercase tracking-widest font-black text-[10px]">
                  <Droplets className="w-4 h-4" /> Blood:{" "}
                  {student.blood_type || "N/A"}
                </span>
                {(student as any).boarding_status &&
                  (student as any).boarding_status !== "day" && (
                    <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-teal-100 dark:border-teal-800">
                      {(student as any).boarding_status}
                    </span>
                  )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {attendancePct}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Attendance
                </div>
              </div>
              <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {gradeHistory.length > 0
                    ? `${gradeHistory[gradeHistory.length - 1].average}%`
                    : "N/A"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Avg Grade
                </div>
              </div>
              <div className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div
                  className={`text-xl font-bold ${
                    feePosition.total - feePosition.paid > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {feePosition.total - feePosition.paid > 0
                    ? `${((feePosition.total - feePosition.paid) / 1000).toFixed(0)}K`
                    : "Paid"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Fee Balance
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              {
                icon: Calendar,
                label: "Schedule",
                color:
                  "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40",
              },
              {
                icon: ClipboardCheck,
                label: "Attendance",
                color:
                  "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
              },
              {
                icon: FileText,
                label: "Evaluations",
                color:
                  "bg-teal-50 dark:bg-teal-900/20 text-primary-600 dark:text-primary-400 hover:bg-teal-100 dark:hover:bg-teal-900/40",
              },
              {
                icon: CreditCard,
                label: "Fees",
                color:
                  "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40",
              },
              {
                icon: MoreHorizontal,
                label: "More",
                color:
                  "bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700",
              },
            ].map((action) => (
              <button
                key={action.label}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${action.color}`}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Attendance Ring + Heatmap */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            Attendance (Days in School)
          </h3>
          <div className="flex flex-col items-center gap-4">
            {detailsLoading ? (
              <p className="text-xs text-[var(--t3)]">Loading attendance…</p>
            ) : (
              <>
                <AttendanceRing percentage={attendancePct} />
                <AttendanceHeatmap records={attendanceRecords} isDemo={isDemo} />
              </>
            )}
          </div>
        </div>

        {/* Fee Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-yellow-600" />
            Money Owed (Fees)
          </h3>
          {detailsLoading ? (
            <p className="text-xs text-[var(--t3)]">Loading fees…</p>
          ) : (
            <FeeProgressBar paid={feePosition.paid} total={feePosition.total} />
          )}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              {feePosition.total - feePosition.paid > 0 ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    Outstanding balance
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    All fees paid
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Grade Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Marks Trend (Performance)
          </h3>
          <div className="flex items-center justify-center py-4">
            {detailsLoading ? (
              <p className="text-xs text-[var(--t3)]">Loading grades…</p>
            ) : gradeHistory.length > 0 ? (
              <GradeSparkline data={gradeHistory} />
            ) : (
              <p className="text-xs text-[var(--t3)]">No grade history yet</p>
            )}
          </div>
          <div className="mt-2 text-xs text-[var(--t3)] text-center">
            {gradeHistory.length > 0
              ? "Last 6 terms average progression"
              : "Add grades to see trends"}
          </div>
        </div>
      </div>

      {/* Contact & Parents Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Contact */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Contact Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Parent Phone
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {student.parent_phone || "N/A"}
                </div>
              </div>
            </div>
            {student.parent_phone2 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Parent Phone 2
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {student.parent_phone2}
                  </div>
                </div>
              </div>
            )}
            {student.parent_email && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Email
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {student.parent_email}
                  </div>
                </div>
              </div>
            )}
            {student.address && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Address
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {student.address}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Birthday
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {student.date_of_birth
                    ? new Date(student.date_of_birth).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Joined School On
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {student.admission_date
                    ? new Date(student.admission_date).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Parents */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Parent/Guardian
          </h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {student.parent_name || "N/A"}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Primary Guardian
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {student.parent_phone || "N/A"}
                </span>
              </div>
              {student.parent_phone2 && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {student.parent_phone2}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info - House, Origin, Leadership */}
      {(student.houses ||
        (student as any).previous_school ||
        (student as any).district_origin ||
        (student as any).prefect_role ||
        (student as any).student_council_role) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {student.houses && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                House & Boarding
              </h3>
              <div className="space-y-3">
                {student.houses && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                      <Home className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        House
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {student.houses.name || "Assigned"}
                      </div>
                    </div>
                  </div>
                )}
                {(student as any).boarding_status &&
                  (student as any).boarding_status !== "day" && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
                        <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Boarding
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {(student as any).boarding_status}
                        </div>
                      </div>
                    </div>
                  )}
                {(student as any).games_house && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Games House
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(student as any).games_house || "Assigned"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {((student as any).previous_school ||
            (student as any).district_origin) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Origin
              </h3>
              <div className="space-y-3">
                {(student as any).previous_school && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <School className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Previous School
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(student as any).previous_school}
                      </div>
                    </div>
                  </div>
                )}
                {(student as any).district_origin && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        District
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(student as any).district_origin}
                      </div>
                    </div>
                  </div>
                )}
                {(student as any).sub_county && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Sub-county
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(student as any).sub_county}
                      </div>
                    </div>
                  </div>
                )}
                {(student as any).village && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                      <Home className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Village
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(student as any).village}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {((student as any).prefect_role ||
            (student as any).student_council_role ||
            (student as any).is_class_monitor) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Leadership
              </h3>
              <div className="space-y-3">
                {(student as any).is_class_monitor && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                      <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Role
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Class Monitor
                      </div>
                    </div>
                  </div>
                )}
                {(student as any).prefect_role && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Prefect Role
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {(student as any).prefect_role.replace(/_/g, " ")}
                      </div>
                    </div>
                  </div>
                )}
                {(student as any).student_council_role && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Council Role
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {(student as any).student_council_role.replace(
                          /_/g,
                          " ",
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Grade Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Grade Progress
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={gradeHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="term"
                tick={{ fontSize: 10, fill: "var(--t3)" }}
                stroke="var(--border)"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--t3)" }}
                stroke="var(--border)"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--t1)",
                }}
              />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: "#2563eb" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Subject Scores */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Subject Scores
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subjectScores}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "var(--t3)" }}
                stroke="var(--border)"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--t3)" }}
                stroke="var(--border)"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--t1)",
                }}
              />
              <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Student Number",
            value: student.student_number || "N/A",
            icon: IdCard,
            color: "bg-blue-500",
          },
          {
            label: "Gender",
            value: student.gender === "M" ? "Male" : "Female",
            icon: User,
            color: "bg-green-500",
          },
          {
            label: "Class",
            value: classLabel,
            icon: GraduationCap,
            color: "bg-primary-500",
          },
          {
            label: "Status",
            value: statusCfg.label,
            icon: TrendingUp,
            color: statusCfg.dot.replace("bg-", "bg-"),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SMS Modal */}
      <SendSMSModal
        student={{
          id: student.id,
          first_name: student.first_name || "",
          last_name: student.last_name || "",
          parent_phone: student.parent_phone,
          parent_name: student.parent_name,
        }}
        isOpen={smsOpen}
        onClose={() => setSmsOpen(false)}
      />
    </div>
    </PageErrorBoundary>
  );
}
