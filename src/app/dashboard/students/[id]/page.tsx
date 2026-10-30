"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { useStudent, useClasses } from "@/lib/hooks";
import { SendSMSModal } from "@/components/SendSMSModal";
import { useToast } from "@/components/Toast";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { canAccess, type UserRole } from "@/lib/roles";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardBody } from "@/components/ui/Card";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { telHref, whatsappHref } from "@/lib/phone-links";
import ContactActions from "@/components/students/ContactActions";
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
            .eq("assessment_type", "exam")
            .order("term", { ascending: true })
            .order("created_at", { ascending: true })
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
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Attendance</div>
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
      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--t3)] font-medium">
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
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-700"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-700"
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
      <div className="flex justify-between mt-1 text-xs text-[var(--t3)]">
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
        <div className="flex items-center gap-0.5 text-xs font-bold text-[var(--t3)] uppercase tracking-wider">
          {trend ? (
            <MaterialIcon icon="trending_up" size={12} className="h-3 text-emerald-500" />
          ) : (
            <MaterialIcon icon="trending_up" size={12} className="h-3 text-red-500 rotate-180" />
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

function fmtDate(value?: string | null): string | null {
  return value ? new Date(value).toLocaleDateString() : null;
}

function InfoCard({
  title,
  icon,
  action,
  className = "",
  children,
}: {
  title: string;
  icon: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-[var(--t1)]">
          <MaterialIcon icon={icon} size={16} className="w-4 text-[var(--t3)]" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--t3)]">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm ${value ? "font-semibold text-[var(--t1)]" : "italic text-[var(--t3)]"} ${mono ? "font-mono" : ""}`}
      >
        {value || "Not recorded"}
      </dd>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id || "";
  const { isDemo, school, user } = useAuth();

  // Teachers have students:true (read) but not settings/messages. Editing a
  // student and messaging parents are admin concerns, so gate both.
  const canEditStudent = user?.role ? canAccess(user.role as UserRole, "settings") : false;
  const canEditDetails = user?.role ? canAccess(user.role as UserRole, "students") : false;
  const canSmsParent = user?.role ? canAccess(user.role as UserRole, "messages") : false;
  // A pupil's fee position is financial data about a family. Teachers hold
  // students:true so they reach this page, but they do not hold fees — so the
  // balance tile and the outstanding-balance prompt are theirs only for the
  // roles that handle money (headmaster, admin, school_admin, super_admin,
  // bursar). A teacher should not learn what a family owes.
  const canSeeFeePosition = user?.role ? canAccess(user.role as UserRole, "fees") : false;
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
  const isOnline = useOnlineStatus();
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
        await withTimeout(
          supabase
            .from("students")
            .update({
              parent_name: guardianForm.name,
              parent_phone: guardianForm.phone,
            })
            .eq("id", studentId),
          15000,
          timeoutFallback(),
        );
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
    if (!isOnline) {
      await offlineDB.save("students", { id: studentId, parent_name: name, parent_phone: phone });
      refetch();
      toast.success("Primary guardian updated on this device. It will sync when you are back online.");
      return;
    }
    await withTimeout(
      supabase.from("students").update({ parent_name: name, parent_phone: phone }).eq("id", studentId),
      15000,
      timeoutFallback(),
    );
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
      if (!isOnline) {
        await offlineDB.save("students", { ...normalized, id });
        refetch();
        return;
      }
      const { error } = await withTimeout(supabase.from("students").update(normalized).eq("id", id), 15000, {
        data: null,
        error: { message: "Save timed out", name: "TimeoutError" },
      } as any);
      if (error) throw error;
      refetch();
    },
    [isOnline, refetch],
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

  const profileTabs = [
    { id: "overview", label: "Overview" },
    { id: "academics", label: "Academics", count: subjectScores.length > 0 ? subjectScores.length : undefined },
    ...(canSeeFeePosition ? [{ id: "fees", label: "Fees" }] : []),
    { id: "guardians", label: "Guardians", count: guardians.length > 0 ? guardians.length : undefined },
    { id: "messages", label: "Messages", count: smsHistory.length > 0 ? smsHistory.length : undefined },
  ];

  const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unnamed student";
  const initials = `${student.first_name?.[0] || "?"}${student.last_name?.[0] || ""}`;
  const genderLabel = student.gender === "M" ? "Male" : student.gender === "F" ? "Female" : null;
  const leadershipRoles = [
    student.prefect_role,
    student.student_council_role,
    student.is_class_monitor ? "Class monitor" : null,
  ].filter(Boolean) as string[];

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

        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="h-20 bg-[var(--navy)] opacity-90 sm:h-24" />
          <div className="px-5 pb-5 sm:px-7">
            <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-[var(--surface)] bg-[var(--navy-soft)] shadow-md sm:h-28 sm:w-28">
                  {student.photo_url ? (
                    <Image
                      src={student.photo_url}
                      alt={fullName}
                      width={224}
                      height={224}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-[var(--navy)]">
                      {initials}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)] ${statusCfg.dot}`}
                    title={statusCfg.label}
                  />
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/students"
                      aria-label="Back to students"
                      className="shrink-0 rounded-lg p-1 text-[var(--t3)] hover:bg-[var(--surface-container-low)]"
                    >
                      <MaterialIcon icon="arrow_back" size={18} />
                    </Link>
                    <h1 className="truncate text-2xl font-bold text-[var(--t1)]">{fullName}</h1>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-container-low)] px-2.5 py-1 text-xs font-medium text-[var(--t2)]">
                      <MaterialIcon icon="school" size={12} className="w-3" />
                      {classLabel}
                    </span>
                    {student.student_number && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-container-low)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--t2)]">
                        <MaterialIcon icon="badge" size={12} className="w-3" />
                        {student.student_number}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                    {student.repeating && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Repeating
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {canEditDetails && (
                  <button
                    type="button"
                    onClick={() => setShowEdit(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    <MaterialIcon icon="edit" size={16} className="w-4" />
                    Edit details
                  </button>
                )}
                {canSmsParent && (
                  <button
                    type="button"
                    onClick={() => setSmsOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--t1)] transition-colors hover:bg-[var(--surface-container-low)]"
                  >
                    <MaterialIcon icon="chat" size={16} className="w-4" />
                    SMS parent
                  </button>
                )}
                {canSeeFeePosition && (
                  <Link
                    href={`/dashboard/fees?pay=${student.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--t1)] transition-colors hover:bg-[var(--surface-container-low)]"
                  >
                    <MaterialIcon icon="payments" size={16} className="w-4" />
                    Record payment
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Attendance",
              value: `${attendancePct}%`,
              tone: "text-emerald-600 dark:text-emerald-400",
              icon: "fact_check",
            },
            ...(canSeeFeePosition
              ? [
                  {
                    label: "Balance",
                    value: outstandingBalance > 0 ? `UGX ${outstandingBalance.toLocaleString()}` : "Cleared",
                    tone:
                      outstandingBalance > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    icon: "payment",
                  },
                ]
              : []),
            {
              label: "Average",
              value: latestGrade !== null ? `${latestGrade}%` : "No grades",
              tone: "text-blue-600 dark:text-blue-400",
              icon: "trending_up",
            },
            {
              label: "Contacts",
              value: `${parentContacts} linked`,
              tone: "text-[var(--t1)]",
              icon: "call",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-container-low)]">
                <MaterialIcon icon={item.icon} size={20} className={item.tone} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--t3)]">{item.label}</div>
                <div className={`mt-0.5 truncate text-base font-bold ${item.tone}`}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <Tabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        <TabPanel activeTab={activeTab} tabId="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <InfoCard title="Personal details" icon="person">
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <DetailRow label="Student number" value={student.student_number} mono />
                  <DetailRow label="Class" value={classLabel} />
                  <DetailRow label="Gender" value={genderLabel} />
                  <DetailRow label="Date of birth" value={fmtDate(student.date_of_birth)} />
                  <DetailRow label="Nationality" value={student.nationality} />
                  <DetailRow label="Religion" value={student.religion} />
                  <DetailRow label="Blood type" value={student.blood_type} />
                  <DetailRow label="National ID (NIN)" value={student.nin} mono />
                  <DetailRow label="Admission date" value={fmtDate(student.admission_date)} />
                  <DetailRow label="Previous school" value={student.previous_school} />
                  <DetailRow label="Boarding" value={student.boarding_status} />
                  <DetailRow label="Games house" value={student.games_house} />
                </dl>
              </InfoCard>

              <InfoCard title="Home & origin" icon="home">
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <DetailRow label="District of origin" value={student.district_origin} />
                  <DetailRow label="Sub-county" value={student.sub_county} />
                  <DetailRow label="Parish" value={student.parish} />
                  <DetailRow label="Village" value={student.village} />
                  <div className="sm:col-span-2">
                    <DetailRow label="Home address" value={student.address} />
                  </div>
                </dl>
              </InfoCard>
            </div>

            <div className="space-y-6">
              <InfoCard title="Attendance" icon="fact_check">
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
                      <div className="mt-4 rounded-xl bg-[var(--surface-container-low)] p-3 text-xs text-[var(--t2)]">
                        Heatmap hidden to reduce data and rendering costs on slower connections.
                      </div>
                    )}
                  </>
                )}
              </InfoCard>

              <InfoCard title="Leadership & status" icon="star">
                <dl className="grid gap-4">
                  <DetailRow label="Roles" value={leadershipRoles.length > 0 ? leadershipRoles.join(" · ") : null} />
                  <DetailRow label="Status" value={statusCfg.label} />
                  <DetailRow label="Repeating" value={student.repeating ? "Yes" : "No"} />
                </dl>
              </InfoCard>

              <InfoCard title="Primary guardian" icon="call">
                <div className="space-y-3 text-sm text-[var(--t1)]">
                  <div className="font-semibold">{student.parent_name || "Not recorded"}</div>
                  {student.parent_phone ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{student.parent_phone}</span>
                      <ContactActions phone={student.parent_phone} name={student.parent_name || undefined} />
                    </div>
                  ) : (
                    <div className="text-[var(--t3)]">No phone recorded</div>
                  )}
                  {student.parent_email && <div className="break-all text-[var(--t2)]">{student.parent_email}</div>}
                </div>
              </InfoCard>
            </div>
          </div>
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="academics" lazy>
          <div className="grid gap-6 lg:grid-cols-3">
            <InfoCard title="Performance trend" icon="trending_up">
              {detailsLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
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
            </InfoCard>

            <InfoCard title="Subject scores" icon="menu_book" className="lg:col-span-2">
              {detailsLoading ? (
                <Skeleton className="h-48 w-full rounded-2xl" />
              ) : subjectScores.length === 0 ? (
                <p className="text-sm text-[var(--t3)]">No exam scores recorded yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {subjectScores.map((s, i) => (
                    <li key={`${s.subject}-${i}`} className="flex items-center gap-3 py-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--t1)]">{s.subject}</span>
                      <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-[var(--surface-container-low)] sm:block">
                        <div
                          className={`h-full rounded-full ${s.score >= 50 ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm font-bold tabular-nums text-[var(--t1)]">{s.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </InfoCard>
          </div>
        </TabPanel>

        {canSeeFeePosition && (
          <TabPanel activeTab={activeTab} tabId="fees" lazy>
            <InfoCard title="Fee position" icon="payment">
              {detailsLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : (
                <div className="space-y-4">
                  <FeeProgressBar paid={feePosition.paid} total={feePosition.total} />
                  <div className="rounded-xl bg-[var(--surface-container-low)] p-3 text-sm text-[var(--t2)]">
                    {outstandingBalance > 0
                      ? `Outstanding balance: UGX ${outstandingBalance.toLocaleString()}`
                      : "All fees are cleared."}
                  </div>
                </div>
              )}
            </InfoCard>
          </TabPanel>
        )}

        <TabPanel activeTab={activeTab} tabId="guardians" lazy>
          <InfoCard
            title="Guardians & contacts"
            icon="call"
            action={
              canEditStudent ? (
                <button
                  type="button"
                  onClick={() => setShowGuardianModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  <MaterialIcon icon="person" size={14} className="w-3.5" />
                  Add guardian
                </button>
              ) : undefined
            }
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--t3)]">Primary contact</p>
            <div className="space-y-3 text-sm text-[var(--t1)]">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="person" size={16} className="w-4 text-[var(--t3)]" />
                <span className="font-medium">{student.parent_name || "Not recorded"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MaterialIcon icon="call" size={16} className="w-4 text-[var(--t3)]" />
                <span>{student.parent_phone || "Not recorded"}</span>
                <ContactActions phone={student.parent_phone} name={student.parent_name || undefined} />
              </div>
              {student.parent_phone2 && (
                <div className="flex items-center gap-2">
                  <MaterialIcon icon="call" size={16} className="w-4 text-[var(--t3)]" />
                  <span>{student.parent_phone2}</span>
                </div>
              )}
              {student.parent_email && (
                <div className="flex items-center gap-2 break-all">
                  <MaterialIcon icon="mail" size={16} className="w-4 text-[var(--t3)]" />
                  <span>{student.parent_email}</span>
                </div>
              )}
            </div>
            {canEditStudent && student.parent_phone && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleCreatePortalAccess}
                  disabled={creatingPortal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <MaterialIcon icon="person" size={14} className="w-3.5" />
                  {creatingPortal ? "Creating..." : "Create parent portal access"}
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

            <div className="my-5 border-t border-[var(--border)]" />
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--t3)]">Linked guardians</p>
            {guardiansLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : guardians.length === 0 ? (
              <p className="text-sm text-[var(--t3)]">
                No additional guardians linked. The primary contact above is used.
              </p>
            ) : (
              <div className="space-y-2">
                {guardians.map((g) => {
                  const guardianUser = g.users || {};
                  const isPrimary =
                    guardianUser.full_name === student.parent_name || guardianUser.phone === student.parent_phone;
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-xl bg-[var(--surface-container-low)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{guardianUser.full_name || "Unknown"}</span>
                          {isPrimary && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--t3)]">
                          {guardianUser.phone || ""}
                          {g.relationship !== "parent" ? ` · ${g.relationship}` : ""}
                        </div>
                        <div className="mt-1.5">
                          <ContactActions phone={guardianUser.phone} name={guardianUser.full_name || undefined} />
                        </div>
                      </div>
                      {canEditStudent && !isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryGuardian(g)}
                          className="shrink-0 text-xs text-blue-600 hover:underline"
                          title="Set as primary guardian"
                        >
                          Set primary
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </InfoCard>
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="messages" lazy>
          <InfoCard
            title="SMS history"
            icon="chat"
            action={
              canSmsParent ? (
                <button
                  type="button"
                  onClick={() => setSmsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  <MaterialIcon icon="chat" size={14} className="w-3.5" />
                  SMS parent
                </button>
              ) : undefined
            }
          >
            {smsHistoryLoading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : smsHistory.length === 0 ? (
              <p className="text-sm text-[var(--t3)]">No SMS messages have been sent to this student&apos;s parents.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {smsHistory.map((msg) => (
                  <div key={msg.id} className="rounded-xl bg-[var(--surface-container-low)] px-4 py-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--t3)]">
                        {msg.sent_at
                          ? new Date(msg.sent_at).toLocaleString()
                          : new Date(msg.created_at).toLocaleString()}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                    <p className="line-clamp-2 text-sm text-[var(--t1)]">{msg.message}</p>
                    {msg.phone && <p className="mt-1 text-xs text-[var(--t3)]">To: {msg.phone}</p>}
                  </div>
                ))}
              </div>
            )}
          </InfoCard>
        </TabPanel>

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
                  inputMode="tel"
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
