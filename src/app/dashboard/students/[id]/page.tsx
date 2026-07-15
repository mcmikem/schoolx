"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
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
  MessageCircle,
  Copy,
  Share2,
} from "lucide-react";
import { useStudent, useClasses } from "@/lib/hooks";
import { SendSMSModal } from "@/components/SendSMSModal";
import { useToast } from "@/components/Toast";
import { withTimeout } from "@/lib/hooks/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import StudentDetailPanel from "@/components/students/StudentDetailPanel";
import { normalizeStudentInput } from "@/lib/validation";

type AttendanceRecord = {
  status: "present" | "absent" | "late";
  date?: string | null;
};

type GradeRecord = {
  subject_id: string | null;
  score: number | null;
  term: string | null;
  subjects?: { name: string | null } | { name: string | null }[] | null;
};

type FeeRecord = {
  amount_paid: number | null;
  total_fees: number | null;
};

function useStudentData(studentId: string, isDemo: boolean, isConstrainedNetwork: boolean) {
  const [attendancePct, setAttendancePct] = useState(0);
  const [feePosition, setFeePosition] = useState({ paid: 0, total: 0 });
  const [gradeHistory, setGradeHistory] = useState<{ term: string; average: number }[]>([]);
  const [subjectScores, setSubjectScores] = useState<{ subject: string; score: number }[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
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
            .eq("student_id", studentId)
            .order("date", { ascending: false })
            .limit(isConstrainedNetwork ? 45 : 180),
          supabase.from("student_fees").select("amount_paid, total_fees").eq("student_id", studentId),
          supabase
            .from("grades")
            .select("subject_id, score, term, subjects(name)")
            .eq("student_id", studentId)
            .limit(isConstrainedNetwork ? 24 : 120),
        ]);
        if (cancelled) return;

        const failedSections: string[] = [];

        if (attendanceError) {
          failedSections.push("attendance");
          setAttendancePct(0);
          setAttendanceRecords([]);
        } else {
          const safeAttendance = (attData || []) as AttendanceRecord[];
          const present = safeAttendance.filter((record) => record.status === "present").length;
          setAttendancePct(safeAttendance.length > 0 ? Math.round((present / safeAttendance.length) * 100) : 0);
          setAttendanceRecords([...safeAttendance].reverse());
        }

        if (feeError) {
          failedSections.push("fees");
          setFeePosition({ paid: 0, total: 0 });
        } else {
          const feeRows = (feeData || []) as FeeRecord[];
          setFeePosition({
            paid: feeRows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0),
            total: feeRows.reduce((sum, row) => sum + Number(row.total_fees || 0), 0),
          });
        }

        if (gradesError) {
          failedSections.push("grades");
          setSubjectScores([]);
          setGradeHistory([]);
        } else {
          const safeGrades = (gradesData || []) as GradeRecord[];
          setSubjectScores(
            safeGrades
              .filter((grade): grade is GradeRecord & { score: number } => typeof grade.score === "number")
              .map((grade) => {
                const subjectName = Array.isArray(grade.subjects) ? grade.subjects[0]?.name : grade.subjects?.name;
                return {
                  subject: subjectName || grade.subject_id || "Unknown",
                  score: grade.score,
                };
              }),
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
                      average: Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length),
                    },
                  ]
                : [],
            );
          } else {
            setGradeHistory([]);
          }
        }

        if (failedSections.length > 0) {
          setDetailsError(
            failedSections.length === 3
              ? "Unable to load student analytics"
              : `Unable to load ${failedSections.join(", ")} analytics`,
          );
        } else {
          setDetailsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setDetailsError(error instanceof Error ? error.message : "Unable to load student analytics");
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
  }, [studentId, isDemo, isConstrainedNetwork]);

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
  const color = percentage >= 80 ? "var(--green)" : percentage >= 60 ? "var(--amber)" : "var(--red)";

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
        <div className="text-lg font-extrabold text-[var(--t1)]">{percentage}%</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">Attendance</div>
      </div>
    </div>
  );
}

function AttendanceHeatmap({ records, isDemo }: { records: AttendanceRecord[]; isDemo: boolean }) {
  const days = useMemo(() => {
    if (isDemo) {
      const result: { status: "present" | "absent" | "late"; date: Date }[] = [];
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

    return records.slice(-30).map((record) => {
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
          {isPaid ? "Fully Paid" : `UGX ${balance.toLocaleString()} outstanding`}
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
          className={`h-full rounded-full transition-all duration-700 ${isPaid ? "bg-emerald-500" : "bg-red-500"}`}
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

function GradeSparkline({ data }: { data: { term: string; average: number }[] }) {
  const width = 120;
  const height = 40;
  const padding = 4;
  const maxVal = 100;
  const minVal = Math.max(0, Math.min(...data.map((d) => d.average)) - 10);
  const range = maxVal - minVal || 1;
  const denominator = Math.max(1, data.length - 1);

  const points = data.map((d, i) => {
    const x = padding + (i / denominator) * (width - padding * 2);
    const y = height - padding - ((d.average - minVal) / range) * (height - padding * 2);
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
          const y = height - padding - ((d.average - minVal) / range) * (height - padding * 2);
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
        <div className={`text-lg font-extrabold ${trend ? "text-emerald-600" : "text-red-600"}`}>{lastVal}%</div>
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

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id || "";
  const { isDemo, school } = useAuth();
  const [isConstrainedNetwork, setIsConstrainedNetwork] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    };

    const connection = nav.connection;
    if (!connection) return;

    const evaluateConnection = () => {
      const type = (connection.effectiveType || "").toLowerCase();
      const constrained = !!connection.saveData || type.includes("2g") || type.includes("3g");
      setIsConstrainedNetwork(constrained);
    };

    evaluateConnection();
    connection.addEventListener?.("change", evaluateConnection);
    return () => connection.removeEventListener?.("change", evaluateConnection);
  }, []);

  const toast = useToast();
  const router = useRouter();
  const { student, loading: studentLoading, error, refetch } = useStudent(studentId);
  const { classes } = useClasses(school?.id);
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

  const analyticsStudentId = studentProfile?.id || "";

  const { attendancePct, feePosition, gradeHistory, subjectScores, attendanceRecords, detailsLoading, detailsError } =
    useStudentData(analyticsStudentId, isDemo, isConstrainedNetwork);

  const [activeTab, setActiveTab] = useState("overview");
  const [smsOpen, setSmsOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [portalCreds, setPortalCreds] = useState<{
    parentPhone: string;
    generatedPassword?: string;
    parentName: string;
    credentialsDelivered: boolean;
  } | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [creatingPortal, setCreatingPortal] = useState(false);

  const [guardians, setGuardians] = useState<any[]>([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [showGuardianModal, setShowGuardianModal] = useState(false);
  const [guardianForm, setGuardianForm] = useState({
    name: "",
    phone: "",
    relationship: "parent",
    email: "",
  });
  const [guardianSaving, setGuardianSaving] = useState(false);

  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [smsHistoryLoading, setSmsHistoryLoading] = useState(false);

  useEffect(() => {
    if (!studentId || isDemo) return;
    let cancelled = false;

    const fetchGuardians = async () => {
      setGuardiansLoading(true);
      const { data, error } = await supabase
        .from("parent_students")
        .select("*, users!parent_id(id, full_name, phone, email)")
        .eq("student_id", studentId);
      if (!cancelled && !error) setGuardians(data || []);
      if (!cancelled) setGuardiansLoading(false);
    };

    const fetchSmsHistory = async () => {
      setSmsHistoryLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("recipient_id", studentId)
        .eq("recipient_type", "individual")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled && !error) setSmsHistory(data || []);
      if (!cancelled) setSmsHistoryLoading(false);
    };

    fetchGuardians();
    fetchSmsHistory();

    return () => {
      cancelled = true;
    };
  }, [studentId, isDemo]);

  const handleAddGuardian = async () => {
    if (!school?.id || !studentId || !guardianForm.name || !guardianForm.phone) {
      toast.error("Name and phone are required");
      return;
    }
    setGuardianSaving(true);
    try {
      const res = await fetch("/api/students/create-parent-portal/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          schoolId: school.id,
          phone: guardianForm.phone,
          fullName: guardianForm.name,
          relationship: guardianForm.relationship,
          sendCredentials: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add guardian");

      const { data: guardianData } = await supabase
        .from("parent_students")
        .select("*, users!parent_id(id, full_name, phone, email)")
        .eq("student_id", studentId);
      if (guardianData) setGuardians(guardianData);

      if (student && !student.parent_name && !student.parent_phone) {
        await supabase
          .from("students")
          .update({
            parent_name: guardianForm.name,
            parent_phone: guardianForm.phone,
          })
          .eq("id", studentId);
        refetch();
      }

      const msg = data.generatedPassword ? `Guardian added. Password: ${data.generatedPassword}` : "Guardian added";
      toast.success(msg);
      setShowGuardianModal(false);
      setGuardianForm({ name: "", phone: "", relationship: "parent", email: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add guardian");
    } finally {
      setGuardianSaving(false);
    }
  };

  const handleSetPrimaryGuardian = async (guardian: any) => {
    const name = guardian.users?.full_name || guardianForm.name;
    const phone = guardian.users?.phone || guardianForm.phone;
    await supabase.from("students").update({ parent_name: name, parent_phone: phone }).eq("id", studentId);
    refetch();
    toast.success("Primary guardian updated");
  };

  const handleCreatePortalAccess = async () => {
    if (!school?.id || !studentId) return;
    setCreatingPortal(true);
    try {
      const res = await fetch("/api/students/create-parent-portal/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, schoolId: school.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create parent portal");
      setPortalCreds({
        parentPhone: data.parentPhone,
        generatedPassword: data.generatedPassword,
        parentName: data.parentName,
        credentialsDelivered: data.credentialsDelivered,
      });
      toast.success(data.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create parent portal");
    } finally {
      setCreatingPortal(false);
    }
  };

  const handleProfileUpdate = useCallback(
    async (id: string, data: any) => {
      const normalized = normalizeStudentInput(data);
      const { error } = await withTimeout(supabase.from("students").update(normalized).eq("id", id), 15000, {
        data: null,
        error: { message: "Save timed out", name: "TimeoutError" },
      } as any);
      if (error) throw error;
      refetch();
    },
    [refetch],
  );

  if (studentLoading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );

  if (error || !student)
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 dark:text-red-400 mb-4">Student not found</div>
        <Link href="/dashboard/students" className="btn btn-primary">
          Back to Students
        </Link>
      </div>
    );

  const statusCfg = getStatusConfig(student.status);
  const classLabel = student.classes?.name
    ? `${student.classes.name}${student.classes?.stream ? ` ${student.classes.stream}` : ""}`
    : "N/A";
  const outstandingBalance = Math.max((feePosition.total || 0) - (feePosition.paid || 0), 0);
  const parentContacts = [student.parent_phone, student.parent_phone2].filter(Boolean).length;
  const latestGrade = gradeHistory.length > 0 ? gradeHistory[gradeHistory.length - 1].average : null;

  return (
    <PageErrorBoundary>
      <div className="space-y-6">
        {isConstrainedNetwork && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Data saver mode is active. This profile is showing lightweight analytics for faster loading.
          </div>
        )}
        {detailsError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Some student analytics could not be loaded: {detailsError}
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-4 border-white bg-primary-100 shadow-sm dark:border-gray-800 dark:bg-primary-900/50">
              {student.photo_url ? (
                <Image
                  src={student.photo_url}
                  alt={`${student.first_name || "Student"} ${student.last_name || ""}`}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-300">
                  {student.first_name?.[0] || "?"}
                  {student.last_name?.[0] || "?"}
                </span>
              )}
            </div>
            <Link
              href="/dashboard/students"
              className="shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-gray-100">
                {student.first_name || "Unknown"} {student.last_name || "Student"}
              </h1>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {classLabel} · {statusCfg.label}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              onClick={() => setSmsOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <MessageSquare className="h-4 w-4" />
              SMS Parent
            </button>
            <Link
              href="/dashboard/timetable"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </Link>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Attendance", value: `${attendancePct}%`, tone: "text-emerald-600 dark:text-emerald-400" },
            {
              label: "Balance",
              value: outstandingBalance > 0 ? `UGX ${outstandingBalance.toLocaleString()}` : "Cleared",
              tone:
                outstandingBalance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Average",
              value: latestGrade !== null ? `${latestGrade}%` : "No grades",
              tone: "text-blue-600 dark:text-blue-400",
            },
            { label: "Contacts", value: `${parentContacts} linked`, tone: "text-gray-900 dark:text-gray-100" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-700/30"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                {item.label}
              </div>
              <div className={`mt-1 text-sm font-bold ${item.tone}`}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
              Attendance
            </h3>
            {detailsLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : (
              <>
                <AttendanceRing percentage={attendancePct} />
                {!isConstrainedNetwork ? (
                  <div className="mt-4">
                    <AttendanceHeatmap records={attendanceRecords} isDemo={isDemo} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
                    Heatmap hidden to reduce data and rendering costs on slower connections.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
              <CreditCard className="h-4 w-4 text-yellow-600" />
              Fees
            </h3>
            {detailsLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : (
              <>
                <FeeProgressBar paid={feePosition.paid} total={feePosition.total} />
                <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">
                  {outstandingBalance > 0
                    ? `Outstanding balance: UGX ${outstandingBalance.toLocaleString()}`
                    : "All fees are cleared."}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Performance
            </h3>
            {detailsLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : gradeHistory.length > 0 ? (
              !isConstrainedNetwork ? (
                <GradeSparkline data={gradeHistory} />
              ) : (
                <div className="rounded-xl bg-blue-50 px-3 py-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  Current average: {latestGrade}%
                </div>
              )
            ) : (
              <p className="text-sm text-[var(--t3)]">No grade history yet.</p>
            )}
            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
              {gradeHistory.length > 0 ? "Last terms average progression" : "Add grades to see trends"}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Parent/Guardian</h3>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{student.parent_phone || "N/A"}</span>
              </div>
              {student.parent_phone2 && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{student.parent_phone2}</span>
                </div>
              )}
              {student.parent_email && (
                <div className="flex items-center gap-2 break-all">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{student.parent_email}</span>
                </div>
              )}
              {(student.village || student.parish || student.sub_county || student.district_origin) && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                  <span>
                    {[student.village, student.parish, student.sub_county, student.district_origin]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
            {student.parent_phone && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleCreatePortalAccess}
                  disabled={creatingPortal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <User className="h-3.5 w-3.5" />
                  {creatingPortal ? "Creating..." : "Create Parent Portal Access"}
                </button>
              </div>
            )}
            {portalCreds && (
              <div className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
                <p className="font-medium">{portalCreds.parentName}</p>
                <p className="mt-1">Phone: {portalCreds.parentPhone}</p>
                {portalCreds.generatedPassword && (
                  <p className="mt-1 font-mono text-xs">
                    Password: <span className="font-bold">{portalCreds.generatedPassword}</span>
                  </p>
                )}
                {portalCreds.credentialsDelivered ? (
                  <p className="mt-1 text-green-600">Credentials sent via WhatsApp</p>
                ) : (
                  <p className="mt-1 text-amber-600">Share the password above with the parent</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Quick Facts</h3>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center justify-between gap-4">
                <span>Student number</span>
                <span className="font-semibold">{student.student_number || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Gender</span>
                <span className="font-semibold">{student.gender === "M" ? "Male" : "Female"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Parent contacts</span>
                <span className="font-semibold">{parentContacts}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Joined</span>
                <span className="font-semibold">
                  {student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Guardians</h3>
            <button
              onClick={() => setShowGuardianModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              <User className="h-3.5 w-3.5" />
              Add Guardian
            </button>
          </div>
          {guardiansLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : guardians.length === 0 ? (
            <p className="text-sm text-[var(--t3)]">No additional guardians linked. Primary guardian is shown above.</p>
          ) : (
            <div className="space-y-2">
              {guardians.map((g) => {
                const user = g.users || {};
                const isPrimary = user.full_name === student.parent_name || user.phone === student.parent_phone;
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/30"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{user.full_name || "Unknown"}</span>
                        {isPrimary && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--t3)]">
                        {user.phone || ""}
                        {g.relationship !== "parent" ? ` · ${g.relationship}` : ""}
                      </div>
                    </div>
                    {!isPrimary && (
                      <button
                        onClick={() => handleSetPrimaryGuardian(g)}
                        className="text-xs text-blue-600 hover:underline"
                        title="Set as primary guardian"
                      >
                        Set Primary
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            SMS History
          </h3>
          {smsHistoryLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : smsHistory.length === 0 ? (
            <p className="text-sm text-[var(--t3)]">No SMS messages have been sent to this student&apos;s parents.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {smsHistory.map((msg) => (
                <div key={msg.id} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--t3)]">
                      {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : new Date(msg.created_at).toLocaleString()}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        msg.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : msg.status === "delivered"
                            ? "bg-blue-100 text-blue-700"
                            : msg.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{msg.message}</p>
                  {msg.phone && <p className="text-xs text-[var(--t3)] mt-1">To: {msg.phone}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

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

        <StudentDetailPanel
          mode="edit"
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          schoolId={school?.id}
          classes={classes}
          isDemo={!!isDemo}
          toast={toast}
          updateStudent={handleProfileUpdate}
          student={student as any}
        />
      </div>

      {showGuardianModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGuardianModal(false)}
        >
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--t1)] mb-2">Add Guardian</h3>
            <p className="text-sm text-[var(--t3)] mb-5">Search existing users or add a new parent/guardian.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={guardianForm.name}
                  onChange={(e) => setGuardianForm({ ...guardianForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={guardianForm.phone}
                  onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  placeholder="0700000000"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={guardianForm.email}
                  onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  placeholder="guardian@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">
                  Relationship
                </label>
                <select
                  value={guardianForm.relationship}
                  onChange={(e) =>
                    setGuardianForm({
                      ...guardianForm,
                      relationship: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  <option value="parent">Parent</option>
                  <option value="guardian">Guardian</option>
                  <option value="aunt">Aunt</option>
                  <option value="uncle">Uncle</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGuardianModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGuardian}
                  disabled={guardianSaving || !guardianForm.name || !guardianForm.phone}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {guardianSaving ? "Adding..." : "Add Guardian"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageErrorBoundary>
  );
}
