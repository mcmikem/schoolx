"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { DEMO_ATTENDANCE, DEMO_STUDENTS } from "@/lib/demo-data";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageGuidance } from "@/components/PageGuidance";
import {
  normalizeAttendanceInput,
  validateAttendanceInput,
} from "@/lib/validation";

const STATUS_CYCLE = ["absent", "present", "late"] as const;
type AttendanceStatus = (typeof STATUS_CYCLE)[number];

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { color: string; bg: string; label: string; icon: string }
> = {
  absent: {
    color: "bg-error",
    bg: "bg-error-container",
    label: "Not In School",
    icon: "cancel",
  },
  present: {
    color: "bg-secondary",
    bg: "bg-secondary-container",
    label: "In School",
    icon: "check_circle",
  },
  late: {
    color: "bg-tertiary",
    bg: "bg-tertiary-container",
    label: "Late",
    icon: "schedule",
  },
};

function cycleStatus(current: string | undefined): AttendanceStatus {
  if (!current) return "present";
  const idx = STATUS_CYCLE.indexOf(current as AttendanceStatus);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export default function AttendancePage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { classes, loading: classesLoading } = useClasses(school?.id);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [students, setStudents] = useState<
    Array<{
      id: string;
      first_name: string;
      last_name: string;
      student_number: string;
    }>
  >([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [allMarked, setAllMarked] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [rollCallMode, setRollCallMode] = useState(false);
  const [showQuickAbsentModal, setShowQuickAbsentModal] = useState(false);
  const [selectedAbsentIds, setSelectedAbsentIds] = useState<Set<string>>(
    new Set(),
  );
  const [filterStatus, setFilterStatus] = useState<"all" | AttendanceStatus>(
    "all",
  );

  const isClassTeacher = user?.role === "teacher";
  const isAdmin =
    user?.role === "headmaster" ||
    user?.role === "dean_of_studies" ||
    user?.role === "school_admin" ||
    user?.role === "super_admin" ||
    user?.role === "bursar";

  const filteredClasses =
    isClassTeacher && !isAdmin
      ? classes.filter((c) => c.class_teacher_id === user?.id)
      : classes;

  const loadOfflineCount = useCallback(async () => {
    try {
      const pending = await offlineDB.getPendingSync();
      const attendancePending = pending.filter((p) => p.table === "attendance");
      setOfflineCount(attendancePending.length);
    } catch {
      setOfflineCount(0);
    }
  }, []);

  useEffect(() => {
    loadOfflineCount();
  }, [loadOfflineCount]);

  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClass || !school?.id) return;

      try {
        setLoading(true);
        let studentsData: any[] = [];
        let attendanceData: any[] = [];

        if (isDemo) {
          studentsData = DEMO_STUDENTS.filter(
            (student) =>
              student.school_id === school.id &&
              student.class_id === selectedClass &&
              student.status === "active",
          );
          attendanceData = DEMO_ATTENDANCE.filter(
            (record) =>
              record.class_id === selectedClass && record.date === date,
          );
        } else if (isOnline) {
          // Parallelize queries for better performance
          const [studentsRes, attendanceRes] = await Promise.all([
            supabase
              .from("students")
              .select(
                "id, first_name, last_name, student_number, class_id, gender, status",
              )
              .eq("school_id", school.id)
              .eq("class_id", selectedClass)
              .eq("status", "active")
              .order("first_name"),
            supabase
              .from("attendance")
              .select("student_id, status")
              .eq("class_id", selectedClass)
              .eq("date", date),
          ]);

          if (studentsRes.error) throw studentsRes.error;
          studentsData = studentsRes.data || [];
          attendanceData = attendanceRes.data || [];

          // Cache for offline in background
          offlineDB
            .cacheFromServer(
              "students",
              studentsData as Record<string, unknown>[],
            )
            .catch(() => {});
          offlineDB
            .cacheFromServer(
              "attendance",
              attendanceData as Record<string, unknown>[],
            )
            .catch(() => {});
        } else {
          studentsData = (await offlineDB.getAllFromCache("students", {
            school_id: school.id,
            class_id: selectedClass,
            status: "active",
          })) as unknown as Array<{
            id: string;
            first_name: string;
            last_name: string;
            student_number: string;
          }>;
          attendanceData = (await offlineDB.getAllFromCache("attendance", {
            class_id: selectedClass,
            date,
          })) as unknown as Array<{ student_id: string; status: string }>;
        }

        const attendanceMap: Record<string, string> = {};
        attendanceData?.forEach(
          (record: { student_id: string; status: string }) => {
            attendanceMap[record.student_id] = record.status;
          },
        );
        setStudents(studentsData || []);
        if (rollCallMode) {
          const defaulted: Record<string, string> = {};
          (studentsData || []).forEach((s) => {
            defaulted[s.id] = attendanceMap[s.id] || "present";
          });
          setAttendance(defaulted);
        } else {
          setAttendance(attendanceMap);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [selectedClass, date, school?.id, isDemo, isOnline, rollCallMode]);

  useEffect(() => {
    if (rollCallMode && students.length > 0) {
      setAttendance((prev) => {
        const defaulted: Record<string, string> = {};
        students.forEach((s) => {
          defaulted[s.id] = prev[s.id] || "present";
        });
        return defaulted;
      });
    }
  }, [rollCallMode, students]);

  const markAttendance = (studentId: string, status: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleTapStatus = (studentId: string) => {
    const current = attendance[studentId];
    const next = cycleStatus(current);
    markAttendance(studentId, next);
  };

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {};
    students.forEach((s) => {
      newAttendance[s.id] = status;
    });
    setAttendance(newAttendance);
    setAllMarked(true);
  };

  const handleMarkAllPresent = () => {
    if (allMarked) {
      markAll("absent");
      toast.info("Reset all to absent");
    } else {
      const confirmed = window.confirm(
        `Mark all ${students.length} students as present?`,
      );
      if (confirmed) {
        markAll("present");
        toast.success("All marked present");
      }
    }
  };

  const handleQuickAbsentApply = () => {
    if (selectedAbsentIds.size === 0) {
      toast.warning("No students selected");
      return;
    }
    setAttendance((prev) => {
      const updated = { ...prev };
      selectedAbsentIds.forEach((id) => {
        updated[id] = "absent";
      });
      return updated;
    });
    toast.success(`${selectedAbsentIds.size} student(s) marked absent`);
    setSelectedAbsentIds(new Set());
    setShowQuickAbsentModal(false);
  };

  const toggleAbsentSelection = (studentId: string) => {
    setSelectedAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const filteredStudents = useMemo(() => {
    if (filterStatus === "all") return students;
    return students.filter((s) => attendance[s.id] === filterStatus);
  }, [students, attendance, filterStatus]);

  const saveAttendance = async () => {
    if (!selectedClass || !user?.id) return;

    const records = Object.entries(attendance).map(([studentId, status]) =>
      normalizeAttendanceInput({
        student_id: studentId,
        class_id: selectedClass,
        date,
        status,
        recorded_by: user.id,
      }),
    );

    if (records.length === 0) {
      toast.warning("No attendance records to save");
      return;
    }

    const invalidRecord = records.find(
      (record) => validateAttendanceInput(record).length > 0,
    );
    if (invalidRecord) {
      const [message] = validateAttendanceInput(invalidRecord);
      toast.error(message);
      return;
    }

    setSaving(true);

    if (isOnline) {
      try {
        const { error } = await supabase
          .from("attendance")
          .upsert(records, { onConflict: "student_id,date" });

        if (error) throw error;
        await offlineDB.cacheFromServer(
          "attendance",
          records as unknown as Record<string, unknown>[],
        );
        if (school?.id && user?.id) {
          await logAuditEventWithOfflineSupport(
            true,
            school.id,
            user.id,
            user.full_name,
            "update",
            "attendance",
            `Saved attendance batch for ${records.length} student(s)`,
            `${selectedClass}:${date}`,
            undefined,
            { count: records.length, class_id: selectedClass, date },
          );
        }
        toast.success("Attendance saved");
        await loadOfflineCount();
      } catch {
        await saveOffline(records);
      } finally {
        setSaving(false);
      }
    } else {
      await saveOffline(records);
      setSaving(false);
    }
  };

  const saveOffline = async (
    records: Array<{
      student_id: string;
      class_id: string;
      date: string;
      status: string;
      recorded_by: string;
    }>,
  ) => {
    try {
      for (const record of records) {
        await offlineDB.save(
          "attendance",
          record as unknown as Record<string, unknown>,
        );
      }
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          "update",
          "attendance",
          `Queued offline attendance batch for ${records.length} student(s)`,
          `${selectedClass}:${date}`,
          undefined,
          { count: records.length, class_id: selectedClass, date },
        );
      }
      toast.success(`Saved locally (${records.length} records)`);
      await loadOfflineCount();
    } catch (err) {
      console.error("Offline save failed:", err);
      toast.error("Failed to save locally");
    }
  };

  const presentCount = Object.values(attendance).filter(
    (s) => s === "present",
  ).length;
  const absentCount = Object.values(attendance).filter(
    (s) => s === "absent",
  ).length;
  const lateCount = Object.values(attendance).filter(
    (s) => s === "late",
  ).length;

  const selectedClassName = filteredClasses.find((c) => c.id === selectedClass);

  return (
    <PageErrorBoundary>
    <>
      <PageHeader
        title="Attendance Center"
        subtitle={`Marking records for ${selectedClassName?.name || "Academic Classes"}`}
        variant="premium"
        actions={
          <div className="flex items-center gap-2">
            {absentCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (
                    !confirm(
                      `Send absence alerts to parents of ${absentCount} absent students?`,
                    )
                  )
                    return;
                  try {
                    const absentees = students.filter(
                      (s) => attendance[s.id] === "absent",
                    );
                    const { supabase: sb } = await import("@/lib/supabase");

                    for (const student of absentees) {
                      const phone = (student as any).parent_phone;
                      if (!phone) continue;

                      await sb.from("messages").insert({
                        school_id: school?.id,
                        recipient_phone: phone,
                        message: `SkoolMate Alert: ${student.first_name} was marked ABSENT today (${date}). Please confirm with school if this is unexpected.`,
                        status: "sent",
                        type: "attendance_alert",
                      });
                    }
                    toast.success(
                      `Absence alerts queued for ${absentees.length} parents`,
                    );
                  } catch (err) {
                    toast.error("Failed to send alerts");
                  }
                }}
                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                icon={<MaterialIcon icon="notification_important" />}
              >
                Notify Parents ({absentCount})
              </Button>
            )}
            <Button
              onClick={saveAttendance}
              disabled={saving || !selectedClass}
              loading={saving}
              variant="primary"
              size="sm"
              icon={<MaterialIcon icon="save" />}
              className="shadow-md shadow-navy/20"
            >
              Save Changes
            </Button>
          </div>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
              Select Class
              {isClassTeacher && !isAdmin && (
                <span className="ml-2 normal-case font-medium text-primary">
                  (your classes)
                </span>
              )}
            </label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-medium">
                  No classes found
                </p>
                <p className="text-amber-600 text-xs mt-1">
                  Classes are created automatically when you register a school.
                  If you are seeing this, please contact support or re-register.
                </p>
              </div>
            ) : (
              <select
                value={selectedClass || ""}
                onChange={(e) => setSelectedClass(e.target.value || null)}
                className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select a class</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.stream ? ` ${c.stream}` : ""} ({c.level})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="sm:w-48">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <EmptyState
          icon="fact_check"
          title="Select a class"
          description={
            isClassTeacher && !isAdmin && filteredClasses.length === 0
              ? "You are not assigned as class teacher for any class"
              : "Choose a class to mark attendance"
          }
        />
      ) : loading ? (
        <TableSkeleton rows={5} />
      ) : students.length === 0 ? (
        <EmptyState
          icon="group"
          title="No students in this class"
          description="Add students to this class first"
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div
              className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 text-center"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="text-2xl md:text-3xl font-bold text-secondary">
                {presentCount}
              </div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">
                In School
              </div>
            </div>
            <div
              className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 text-center"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="text-2xl md:text-3xl font-bold text-error">
                {absentCount}
              </div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">
                Away
              </div>
            </div>
            <div
              className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 text-center"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="text-2xl md:text-3xl font-bold text-tertiary">
                {lateCount}
              </div>
              <div className="text-xs md:text-sm text-on-surface-variant mt-1">
                Late
              </div>
            </div>
          </div>

          <PageGuidance
            title="How to Use Attendance"
            tips={[
              {
                icon: "school",
                text: "Select a class from the dropdown above",
              },
              { icon: "event", text: "Choose the date (defaults to today)" },
              {
                icon: "touch_app",
                text: "Tap a student to change: In School → Away → Late",
              },
              {
                icon: "toggle_on",
                text: "Call Out Names Mode: starts all as In School, tap to mark Away",
              },
              {
                icon: "save",
                text: "Click Save when done - attendance is recorded for that date",
              },
            ]}
          />

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MaterialIcon icon="mic" className="text-xl text-primary" />
                <div>
                  <div className="font-semibold text-on-surface">
                    Call Out Names
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    Everyone starts as In School — tap only those Away
                  </div>
                </div>
              </div>
              <button
                onClick={() => setRollCallMode(!rollCallMode)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200 min-w-[56px] ${
                  rollCallMode ? "bg-primary" : "bg-surface-container-highest"
                }`}
                role="switch"
                aria-checked={rollCallMode}
                aria-label="Toggle Call Out Names Mode"
              >
                <div
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                    rollCallMode ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {rollCallMode ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={handleMarkAllPresent}
                  icon={<MaterialIcon icon="check_circle" />}
                  size="sm"
                >
                  Mark All In School
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowQuickAbsentModal(true)}
                  icon={<MaterialIcon icon="person_remove" />}
                  size="sm"
                >
                  Quick Away
                </Button>
                <div className="flex-1" />
                <div className="text-sm text-on-surface-variant self-center font-medium">
                  {presentCount} present, {absentCount} away, {lateCount} late
                </div>
              </div>

              <div className="flex gap-2">
                {(["all", "present", "absent", "late"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                      filterStatus === f
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {f === "all"
                      ? "All"
                      : f === "present"
                        ? "In School"
                        : f === "absent"
                          ? "Away"
                          : "Late"}
                    {f !== "all" && (
                      <span className="ml-1 opacity-70">
                        (
                        {f === "present"
                          ? presentCount
                          : f === "absent"
                            ? absentCount
                            : lateCount}
                        )
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const status = (attendance[student.id] ||
                    "present") as AttendanceStatus;
                  const config = STATUS_CONFIG[status];
                  const borderColor =
                    status === "present"
                      ? "border-secondary/30"
                      : status === "absent"
                        ? "border-error/30"
                        : "border-tertiary/30";
                  const bgColor =
                    status === "present"
                      ? "bg-secondary/5"
                      : status === "absent"
                        ? "bg-error/5"
                        : "bg-tertiary/5";
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleTapStatus(student.id)}
                      className={`${bgColor} rounded-xl border ${borderColor} p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none min-h-[56px]`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}
                        >
                          <span
                            className={`font-bold text-sm ${status === "present" ? "text-on-secondary-container" : status === "absent" ? "text-on-error-container" : "text-on-tertiary-container"}`}
                          >
                            {student.first_name?.charAt(0)}
                            {student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-on-surface text-base truncate">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {student.student_number}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-md ${config.bg} ${status === "present" ? "text-on-secondary-container" : status === "absent" ? "text-on-error-container" : "text-on-tertiary-container"}`}
                        >
                          {config.label}
                        </span>
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            status === "present"
                              ? "bg-secondary"
                              : status === "absent"
                                ? "bg-error"
                                : "bg-tertiary"
                          }`}
                        >
                          <MaterialIcon
                            icon={config.icon}
                            className="text-white text-lg"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-on-surface-variant">
                    No students with this status
                  </div>
                )}
              </div>

              <div className="fixed bottom-[80px] left-0 right-0 md:relative md:bottom-auto p-4 md:p-0 bg-surface/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t border-outline-variant md:border-0 z-10">
                <Button
                  onClick={saveAttendance}
                  disabled={saving}
                  loading={saving}
                  icon={<MaterialIcon icon="save" />}
                  className="w-full"
                  size="lg"
                >
                  Save: {presentCount} present, {absentCount} away, {lateCount}{" "}
                  late
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleMarkAllPresent}
                  icon={
                    <MaterialIcon icon={allMarked ? "undo" : "check_circle"} />
                  }
                >
                  {allMarked ? "Reset All" : "Mark All In School"}
                </Button>
                <Tabs
                  tabs={[
                    { id: "desktop", label: "List" },
                    { id: "mobile", label: "Cards" },
                  ]}
                  activeTab={viewMode}
                  onChange={(id) => setViewMode(id as "desktop" | "mobile")}
                />
              </div>

              <TabPanel activeTab={viewMode} tabId="desktop">
                <div className="space-y-3">
                  {students.map((student) => {
                    const status = attendance[student.id] as
                      | AttendanceStatus
                      | undefined;
                    const config = status ? STATUS_CONFIG[status] : null;
                    return (
                      <div
                        key={student.id}
                        className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
                              <span className="text-on-primary-container font-bold text-sm">
                                {student.first_name?.charAt(0)}
                                {student.last_name?.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <div className="font-bold text-primary">
                                {student.first_name} {student.last_name}
                                {(student as any).boarding_status &&
                                  (student as any).boarding_status !==
                                    "day" && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded uppercase">
                                      {(student as any).boarding_status}
                                    </span>
                                  )}
                              </div>
                              <div className="text-xs text-on-surface-variant">
                                {student.student_number}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {STATUS_CYCLE.map((s) => {
                              const sConfig = STATUS_CONFIG[s];
                              const isActive = status === s;
                              return (
                                <button
                                  key={s}
                                  onClick={() => markAttendance(student.id, s)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                    isActive
                                      ? `${sConfig.bg} border-${s === "absent" ? "error" : s === "present" ? "secondary" : "tertiary"}`
                                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-outline-variant"
                                  }`}
                                >
                                  {sConfig.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabPanel>

              <TabPanel activeTab={viewMode} tabId="mobile">
                <div className="space-y-2">
                  {students.map((student) => {
                    const status = attendance[student.id] as
                      | AttendanceStatus
                      | undefined;
                    const config = status ? STATUS_CONFIG[status] : null;
                    return (
                      <div
                        key={student.id}
                        onClick={() => handleTapStatus(student.id)}
                        className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
                            <span className="text-on-primary-container font-bold text-sm">
                              {student.first_name?.charAt(0)}
                              {student.last_name?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-primary text-sm">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-xs text-on-surface-variant">
                              {student.student_number}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {config && (
                            <span className="text-xs font-medium text-on-surface-variant">
                              {config.label}
                            </span>
                          )}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              status === "present"
                                ? "bg-secondary"
                                : status === "late"
                                  ? "bg-tertiary"
                                  : status === "absent"
                                    ? "bg-error"
                                    : "bg-surface-container border-2 border-dashed border-outline-variant"
                            }`}
                          >
                            {status && (
                              <MaterialIcon
                                icon={
                                  STATUS_CONFIG[status as AttendanceStatus].icon
                                }
                                className="text-white text-lg"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-center text-xs text-on-surface-variant pt-2">
                    Tap a student to cycle status
                  </p>
                </div>
              </TabPanel>

              <div className="fixed bottom-[80px] left-0 right-0 md:relative md:bottom-auto p-4 md:p-0 bg-surface/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t border-outline-variant md:border-0 z-10">
                <Button
                  onClick={saveAttendance}
                  disabled={saving || Object.keys(attendance).length === 0}
                  loading={saving}
                  icon={<MaterialIcon icon="save" />}
                  className="w-full"
                >
                  {isOnline ? "Save Attendance" : "Save Offline"}
                </Button>
              </div>
            </>
          )}

          <Modal
            isOpen={showQuickAbsentModal}
            onClose={() => {
              setShowQuickAbsentModal(false);
              setSelectedAbsentIds(new Set());
            }}
            title="Quick Mark Absent"
            size="lg"
          >
            <div className="mb-4">
              <p className="text-sm text-on-surface-variant mb-3">
                Select students who are absent. All others remain present.
              </p>
              <div className="flex gap-2 mb-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSelectedAbsentIds(new Set(students.map((s) => s.id)))
                  }
                >
                  Select All
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedAbsentIds(new Set())}
                >
                  Clear All
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const alreadyAbsent = students
                      .filter((s) => attendance[s.id] === "absent")
                      .map((s) => s.id);
                    setSelectedAbsentIds(new Set(alreadyAbsent));
                  }}
                >
                  Select Current Absent
                </Button>
              </div>
              <div className="text-sm font-medium text-on-surface mb-2">
                {selectedAbsentIds.size} student(s) selected
              </div>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {students.map((student) => {
                const isSelected = selectedAbsentIds.has(student.id);
                const currentStatus = attendance[student.id] || "present";
                return (
                  <button
                    key={student.id}
                    onClick={() => toggleAbsentSelection(student.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl min-h-[48px] transition-colors text-left ${
                      isSelected
                        ? "bg-error/10 border border-error/30"
                        : "bg-surface-container hover:bg-surface-container-high"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-error border-error"
                          : "border-outline-variant"
                      }`}
                    >
                      {isSelected && (
                        <MaterialIcon
                          icon="check"
                          className="text-white text-sm"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface text-sm truncate">
                        {student.first_name} {student.last_name}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {student.student_number}
                      </div>
                    </div>
                    {currentStatus !== "present" && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          currentStatus === "absent"
                            ? "bg-error-container text-on-error-container"
                            : "bg-tertiary-container text-on-tertiary-container"
                        }`}
                      >
                        {
                          STATUS_CONFIG[currentStatus as AttendanceStatus]
                            ?.label
                        }
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t border-outline-variant">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowQuickAbsentModal(false);
                  setSelectedAbsentIds(new Set());
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleQuickAbsentApply}
                disabled={selectedAbsentIds.size === 0}
                icon={<MaterialIcon icon="person_remove" />}
                className="flex-1"
              >
                Mark {selectedAbsentIds.size} Absent
              </Button>
            </div>
          </Modal>
        </>
      )}
    </>
    </PageErrorBoundary>
  );
}
