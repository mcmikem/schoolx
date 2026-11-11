"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
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
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import ContactActions from "@/components/students/ContactActions";
import StudentDetailPanel from "@/components/students/StudentDetailPanel";
import { StudentPrivacyEvidencePanel } from "@/components/students/StudentPrivacyEvidencePanel";
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
        <div className="text-lg font-semibold text-[var(--t1)]">{percentage}%</div>
        <div className="text-[11px] font-medium text-[var(--t4)]">Attendance</div>
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
        <span className="text-[13.5px] font-medium text-[var(--t1)]">
          {total <= 0 ? "No fees recorded" : isPaid ? "Fully paid" : `UGX ${balance.toLocaleString()} outstanding`}
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
            isPaid
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-container-low)]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isPaid ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[11px] text-[var(--t4)]">
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
    <div className="flex items-center gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-10 min-w-0 flex-1"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke={trend ? "var(--green)" : "var(--red)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
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
      <div className="shrink-0">
        <div className={`text-lg font-semibold ${trend ? "text-emerald-600" : "text-red-600"}`}>{lastVal}%</div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--t4)]">
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
    bg: "bg-[var(--surface-container-low)] dark:bg-[var(--surface-container-high)]",
    text: "text-[var(--t2)] dark:text-[var(--t4)]",
    border: "border-[var(--border)] dark:border-[var(--border)]",
    dot: "bg-[var(--surface-container-high)]",
    label: status || "Unknown",
  };
}

function fmtDate(value?: string | null): string | null {
  return value ? new Date(value).toLocaleDateString() : null;
}

function MetaChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "amber" }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-[var(--border)] bg-[var(--surface-container-low)] text-[var(--t2)]"
      }`}
    >
      {children}
    </span>
  );
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
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[var(--t1)]">
          <MaterialIcon icon={icon} size={16} className="w-4 shrink-0 text-[var(--t4)]" />
          <span className="truncate">{title}</span>
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-[var(--t4)]">{label}</dt>
      <dd
        className={`mt-1 break-words text-[13.5px] ${value ? "font-medium text-[var(--t1)]" : "italic text-[var(--t3)]"} ${mono ? "font-mono text-[12.5px]" : ""}`}
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
  const canEditStudent = user?.role
    ? canAccess(user.role as UserRole, "settings") || canAccess(user.role as UserRole, "students")
    : false;
  const canEditDetails = user?.role ? canAccess(user.role as UserRole, "students") : false;
  const canSmsParent = user?.role ? canAccess(user.role as UserRole, "messages") : false;
  // A pupil's fee position is financial data about a family. Teachers hold
  // students:true so they reach this page, but they do not hold fees — so the
  // balance tile and the outstanding-balance prompt are theirs only for the
  // roles that handle money (headmaster, admin, school_admin, super_admin,
  // bursar). A teacher should not learn what a family owes.
  const canSeeFeePosition = user?.role ? canAccess(user.role as UserRole, "fees") : false;
  const canManagePrivacyEvidence = ["school_admin", "admin", "headmaster"].includes(user?.role || "");
  const [isConstrainedNetwork, setIsConstrainedNetwork] = useState(false);
  const [showDataSaver, setShowDataSaver] = useState(false);

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

  useEffect(() => {
    if (!isConstrainedNetwork) {
      setShowDataSaver(false);
      return;
    }
    setShowDataSaver(true);
    const t = setTimeout(() => setShowDataSaver(false), 5000);
    return () => clearTimeout(t);
  }, [isConstrainedNetwork]);

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
      <div
        className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-20"
        aria-busy="true"
        aria-label="Loading student profile"
      >
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)] sm:p-6">
          <Skeleton className="h-5 w-24 rounded-md" />
          <div className="mt-4 flex items-start gap-3.5 sm:gap-5">
            <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-24 sm:w-24" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-6 w-2/3 max-w-[240px] rounded-md" />
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  if (error || !student)
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-20">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center shadow-[var(--sh1)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-container-low)]">
            <MaterialIcon icon="person_off" size={22} className="text-[var(--t3)]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--t1)]">Student not found</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-[var(--t3)]">
            This profile may have been moved, merged, or removed.
          </p>
          <Link
            href="/dashboard/students"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-600)]"
          >
            <MaterialIcon icon="arrow_back" size={16} />
            Back to students
          </Link>
        </div>
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
    ...(canManagePrivacyEvidence ? [{ id: "privacy", label: "Privacy & consent" }] : []),
    { id: "health", label: "Health" },
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
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-20">
        {isConstrainedNetwork && showDataSaver && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Data saver mode is active — showing lightweight analytics for faster loading.
          </div>
        )}
        {detailsError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Some student analytics could not be loaded: {detailsError}
          </div>
        )}

        <header className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh1)]">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard/students"
                aria-label="Back to students"
                className="-ml-1.5 inline-flex h-9 items-center gap-1 rounded-lg px-1.5 text-[13px] font-medium text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
              >
                <MaterialIcon icon="arrow_back" size={18} />
                <span className="hidden sm:inline">All students</span>
              </Link>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-4 sm:mt-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex items-start gap-3.5 sm:gap-5">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-container-low)] ring-1 ring-[var(--border)] sm:h-24 sm:w-24">
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
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[var(--t3)] sm:text-2xl">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 sm:pt-1">
                  <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.02em] text-[var(--t1)] sm:text-[26px]">
                    {fullName}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-[var(--t3)]">
                    <span className="inline-flex items-center gap-1">
                      <MaterialIcon icon="school" size={14} className="shrink-0" />
                      {classLabel}
                    </span>
                    {student.student_number ? (
                      <>
                        <span className="text-[var(--t4)]">·</span>
                        <span className="font-mono text-[12px]">{student.student_number}</span>
                      </>
                    ) : null}
                  </p>
                  {(genderLabel || student.boarding_status || student.repeating || leadershipRoles.length > 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {genderLabel && <MetaChip>{genderLabel}</MetaChip>}
                      {student.boarding_status && <MetaChip>{student.boarding_status}</MetaChip>}
                      {leadershipRoles.length > 0 && <MetaChip>{leadershipRoles[0]}</MetaChip>}
                      {student.repeating && <MetaChip tone="amber">Repeating</MetaChip>}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:pt-1">
                {canEditDetails && (
                  <button
                    type="button"
                    onClick={() => setShowEdit(true)}
                    className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-600)] sm:col-span-1"
                  >
                    <MaterialIcon icon="edit" size={16} className="w-4" />
                    Edit details
                  </button>
                )}
                {canSmsParent && (
                  <button
                    type="button"
                    onClick={() => setSmsOpen(true)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-medium text-[var(--t1)] transition-colors hover:bg-[var(--surface-container-low)] sm:px-4 sm:text-sm"
                  >
                    <MaterialIcon icon="chat" size={16} className="w-4" />
                    SMS parent
                  </button>
                )}
                {canSeeFeePosition && (
                  <Link
                    href={`/dashboard/fees?pay=${student.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-medium text-[var(--t1)] transition-colors hover:bg-[var(--surface-container-low)] sm:px-4 sm:text-sm"
                  >
                    <MaterialIcon icon="payments" size={16} className="w-4" />
                    Record payment
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
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
                    value:
                      (feePosition.total || 0) <= 0
                        ? "No fees"
                        : outstandingBalance > 0
                          ? `UGX ${outstandingBalance.toLocaleString()}`
                          : "Cleared",
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
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--sh1)] sm:p-4"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--t4)]">
                <MaterialIcon icon={item.icon} size={13} className="shrink-0" />
                {item.label}
              </div>
              <div className={`mt-1.5 truncate text-[17px] font-semibold tracking-tight sm:text-[18px] ${item.tone}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <Tabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} scroll />

        <TabPanel activeTab={activeTab} tabId="overview">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <InfoCard title="Personal details" icon="person">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:gap-x-8 sm:gap-y-4">
                  <DetailRow label="Student number" value={student.student_number} mono />
                  <DetailRow label="Class" value={classLabel} />
                  <DetailRow label="Gender" value={genderLabel} />
                  <DetailRow label="Date of birth" value={fmtDate(student.date_of_birth)} />
                  <DetailRow label="Nationality" value={student.nationality || "Ugandan"} />
                  <DetailRow label="Religion" value={student.religion} />
                  <DetailRow label="Blood type" value={student.blood_type} />
                  <DetailRow label="National ID (NIN)" value={student.nin} mono />
                  <DetailRow label="Admission date" value={fmtDate(student.admission_date)} />
                  <DetailRow label="Previous school" value={student.previous_school} />
                  <DetailRow label="Boarding" value={student.boarding_status} />
                  <DetailRow label="House" value={student.games_house || (student as any).house_name} />
                </dl>
              </InfoCard>

              <InfoCard title="Home & origin" icon="home">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:gap-x-8 sm:gap-y-4">
                  <DetailRow label="District of origin" value={student.district_origin} />
                  <DetailRow label="Sub-county" value={student.sub_county} />
                  <DetailRow label="Parish" value={student.parish} />
                  <DetailRow label="Village" value={student.village} />
                  <div className="col-span-2">
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
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
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
                    <li key={`${s.subject}-${i}`} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--t1)]">
                        {s.subject}
                      </span>
                      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface-container-low)] sm:w-40">
                        <div
                          className={`h-full rounded-full ${s.score >= 50 ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[13.5px] font-semibold tabular-nums text-[var(--t1)]">
                        {s.score}
                      </span>
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
                  className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--primary-600)]"
                >
                  <MaterialIcon icon="person" size={14} className="w-3.5" />
                  Add guardian
                </button>
              ) : undefined
            }
          >
            <p className="mb-2 text-[11px] font-medium text-[var(--t4)]">Primary contact</p>
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
            {canEditStudent && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleCreatePortalAccess}
                  disabled={creatingPortal}
                  className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--t1)] transition-colors hover:bg-[var(--surface-container-low)] disabled:opacity-50"
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
            <p className="mb-3 text-[11px] font-medium text-[var(--t4)]">Linked guardians</p>
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
                      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium text-[var(--t1)]">
                            {guardianUser.full_name || "Unknown"}
                          </span>
                          {isPrimary && (
                            <span className="shrink-0 rounded-md bg-[var(--primary-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary-700)]">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[var(--t3)]">
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
                          className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[var(--border)] px-2.5 text-[11px] font-medium text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
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

        <TabPanel activeTab={activeTab} tabId="health" lazy>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <InfoCard title="Medical profile" icon="favorite">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:gap-x-8 sm:gap-y-4">
                <DetailRow label="Blood type" value={student.blood_type} />
              </dl>
              <p className="mt-3 text-xs text-[var(--t3)]">
                Full medical records, allergies, medications, and emergency contacts are managed in the Health module.
              </p>
              <Link
                href="/dashboard/health"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                <MaterialIcon icon="open_in_new" size={14} />
                Open Health module
              </Link>
            </InfoCard>
          </div>
        </TabPanel>

        {canManagePrivacyEvidence && (
          <TabPanel activeTab={activeTab} tabId="privacy" lazy>
            <InfoCard title="Learner privacy evidence" icon="privacy_tip">
              <StudentPrivacyEvidencePanel studentId={student.id} />
            </InfoCard>
          </TabPanel>
        )}

        <TabPanel activeTab={activeTab} tabId="messages" lazy>
          <InfoCard
            title="SMS history"
            icon="chat"
            action={
              canSmsParent ? (
                <button
                  type="button"
                  onClick={() => setSmsOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--primary-600)]"
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
                                : "bg-[var(--surface-container)] text-[var(--t2)]"
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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setShowGuardianModal(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-[20px] bg-[var(--surface)] shadow-[var(--sh3)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-guardian-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-4 sm:px-5">
              <div>
                <h3 id="add-guardian-title" className="text-base font-semibold text-[var(--t1)]">
                  Add guardian
                </h3>
                <p className="mt-0.5 text-[12px] text-[var(--t3)]">Links a contact and creates parent-portal access.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuardianModal(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
              >
                <MaterialIcon icon="close" size={18} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[var(--t4)]">Full Name</label>
                  <input
                    type="text"
                    value={guardianForm.name}
                    onChange={(e) => setGuardianForm({ ...guardianForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--t1)] outline-none transition-colors focus:border-[var(--primary)]"
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[var(--t4)]">Phone Number</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={guardianForm.phone}
                    onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--t1)] outline-none transition-colors focus:border-[var(--primary)]"
                    placeholder="0700000000"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[var(--t4)]">Email (optional)</label>
                  <input
                    type="email"
                    value={guardianForm.email}
                    onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--t1)] outline-none transition-colors focus:border-[var(--primary)]"
                    placeholder="guardian@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[var(--t4)]">Relationship</label>
                  <select
                    value={guardianForm.relationship}
                    onChange={(e) =>
                      setGuardianForm({
                        ...guardianForm,
                        relationship: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--t1)] outline-none transition-colors focus:border-[var(--primary)]"
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
              </div>
            </div>
            <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={() => setShowGuardianModal(false)}
                className="min-h-11 flex-1 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddGuardian}
                disabled={guardianSaving || !guardianForm.name || !guardianForm.phone}
                className="min-h-11 flex-1 rounded-xl bg-[var(--primary)] text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-600)] disabled:opacity-50"
              >
                {guardianSaving ? "Adding..." : "Add guardian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageErrorBoundary>
  );
}
