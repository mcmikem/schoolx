"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useClasses, useSubjects, useTimetableManager, useStaff } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { VideoLessonButton } from "@/components/onboarding/VideoLesson";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Button, Modal, StatStrip } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { getLocalDateString, withTimeout, timeoutFallback, isTimeoutResult } from "@/lib/hooks/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import GenerateTimetableModal from "@/components/timetable/GenerateTimetableModal";
import dynamic from "next/dynamic";
const TimetableCalendar = dynamic(() => import("@/components/timetable/TimetableCalendar"), {
  ssr: false,
  loading: () => null,
});
import SchoolDaySetupModal from "@/components/timetable/SchoolDaySetupModal";
import TermCalendar from "@/components/timetable/TermCalendar";
import TimetablePrintSheet from "@/components/timetable/TimetablePrintSheet";
import KikunyuWallTimetable from "@/components/timetable/KikunyuWallTimetable";
import { useAcademic } from "@/lib/academic-context";
import {
  SCHOOL_DAY_PRESETS,
  buildSchoolDay,
  matchWeeklyTarget,
  schoolLevelFromClassName,
  weeklyPeriodTargets,
} from "@/lib/timetable/uganda-day";
import { DEMO_SUBJECTS, DEMO_TIMETABLE } from "@/lib/demo-data";
import { buildDefaultTimetableSlots } from "@/lib/school-setup";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { parseTimetableOcrText } from "@/lib/timetable/ocr-text";

const DAYS = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  // Most Ugandan schools teach or test on Saturday morning; the generator and
  // the database already support day 6, so the grid must show it too.
  { value: 6, label: "Sat", full: "Saturday" },
];

const DEMO_DAY_VALUES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function demoPeriodForStart(startTime: string): number {
  const slots = buildDefaultTimetableSlots("demo");
  const exact = slots.find((slot) => slot.start_time === startTime);
  if (exact) return exact.order_number;
  const lessons = slots.filter((slot) => slot.is_lesson !== false);
  const target = minutesOf(startTime);
  return lessons.reduce(
    (best, slot) =>
      Math.abs(minutesOf(slot.start_time) - target) < Math.abs(minutesOf(best.start_time) - target) ? slot : best,
    lessons[0],
  ).order_number;
}

function mapDemoTimetable(classId?: string): TimetableEntry[] {
  return DEMO_TIMETABLE.filter((row) => !classId || row.class_id === classId).map((row) => {
    const subject = DEMO_SUBJECTS.find((item) => item.id === row.subject_id);
    return {
      ...row,
      day_of_week: DEMO_DAY_VALUES[row.day_of_week] ?? 1,
      period_number: demoPeriodForStart(row.start_time),
      academic_year: "",
      subjects: { name: subject?.name || "Unknown", code: subject?.code || "" },
    };
  });
}

interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  academic_year: string;
  subjects?: { name?: string | null; code?: string | null } | null;
}

interface AllClassTimetableEntry {
  id: string;
  teacher_id: string;
  day_of_week: number;
  period_number: number;
  class_id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  subject_id?: string | null;
  subjects?: any;
}

interface Slot {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  order_number: number;
  is_break?: boolean;
  is_lesson?: boolean;
  period_number?: number;
}

type ClashInfo = {
  type: "teacher" | "room";
  description: string;
  day: number;
};

const TIMETABLE_EDIT_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "dean_of_studies"];

export default function TimetablePage() {
  const { school, user, isDemo } = useAuth();
  const isOnline = useOnlineStatus();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { classes } = useClasses(school?.id);
  const classIdsKey = classes
    .map((classItem) => classItem.id)
    .sort()
    .join("|");
  const classIds = useMemo(() => new Set(classIdsKey ? classIdsKey.split("|") : []), [classIdsKey]);
  const { subjects } = useSubjects(school?.id);
  const { slots, loading: loadingSlots, refetch: refetchSlots } = useTimetableManager(school?.id, school?.school_type);
  const { staff } = useStaff(school?.id);

  // Only show teaching staff in the dropdown
  const teachers = staff.filter((s) =>
    ["teacher", "head_teacher", "dean_of_studies", "deputy_headteacher"].includes(s.role),
  );
  const teacherNameById = useMemo(
    () => Object.fromEntries(teachers.map((teacher): [string, string] => [teacher.id, teacher.full_name])),
    [teachers],
  );
  const staffNameById = useMemo(
    () => Object.fromEntries(staff.map((member): [string, string] => [member.id, member.full_name])),
    [staff],
  );

  const [selectedClassId, setSelectedClassId] = useState("");
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [allClassTimetables, setAllClassTimetables] = useState<AllClassTimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const today = getLocalDateString();
  const todayDay = new Date(today).getDay() || 1; // 0=Sunday → 1, 1-5=Mon-Fri, 6=Sunday→1
  const [selectedDay, setSelectedDay] = useState<number>(todayDay);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [roomValue, setRoomValue] = useState("");
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDaySetup, setShowDaySetup] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportSource, setBulkImportSource] = useState<"csv" | "image">("csv");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [bulkRows, setBulkRows] = useState<
    Array<{
      day_of_week: number;
      period_number: number;
      class_id: string;
      subject_id: string;
      teacher_id: string;
      start_time: string;
      end_time: string;
      room: string | null;
    }>
  >([]);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const timetableImageRef = useRef<HTMLInputElement>(null);
  const [showAllClashes, setShowAllClashes] = useState(false);
  const canAutoGenerate = !!user && TIMETABLE_EDIT_ROLES.includes(user.role);
  // Adding/removing lessons is a school-wide structural change, not a teacher's
  // own diary. RLS on teacher_timetable was `FOR ALL` to any authenticated user
  // in the school, so without this gate a teacher could silently rewrite the
  // whole timetable from the "+ Add lesson" cells.
  const canEditTimetable = !!user && TIMETABLE_EDIT_ROLES.includes(user.role);

  // Rehydrate the last complete school schedule immediately, then refresh it
  // from Supabase when a connection is available. This keeps clash detection
  // useful offline as well as the selected class grid.
  useEffect(() => {
    if (!school?.id) return;
    const classIds = new Set(classes.map((item) => item.id));
    void offlineDB.getAllFromCache("teacher_timetable").then((cached) => {
      const schoolRows = cached.filter((row) => classIds.has(String(row.class_id)));
      if (schoolRows.length) setAllClassTimetables(schoolRows as unknown as AllClassTimetableEntry[]);
    });
  }, [school?.id, classes]);

  // Fetch the timetable for the selected class
  const fetchTimetable = useCallback(async () => {
    if (!selectedClassId) return;
    if (!UUID_PATTERN.test(selectedClassId)) {
      // Demo/local fixtures use non-UUID ids — Postgres rejects them with 22P02
      setTimetable(isDemo ? mapDemoTimetable(selectedClassId) : []);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await withTimeout(
        supabase
          .from("teacher_timetable")
          .select(
            "id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, room, academic_year, subjects(name, code)",
          )
          .eq("class_id", selectedClassId)
          .order("day_of_week")
          .order("period_number"),
        10000,
        timeoutFallback(),
      );
      if (isTimeoutResult(result)) {
        const cached = await offlineDB.getAllFromCache("teacher_timetable", { class_id: selectedClassId });
        if (cached.length) {
          setTimetable(cached as unknown as TimetableEntry[]);
          toast.info("Showing the saved timetable. Reconnect to refresh it.");
        } else {
          toast.error("Timetable is taking too long to load. Check your connection and try again.");
        }
        return;
      }
      const { data, error } = result ?? {};
      if (error) throw error;
      const rows = (data || []) as TimetableEntry[];
      setTimetable(rows);
      await offlineDB.cacheFromServer(
        "teacher_timetable",
        rows.map((row) => ({ ...row, school_id: school?.id })) as unknown as Record<string, unknown>[],
      );
    } catch (err) {
      logger.error("Error fetching timetable:", err);
      const cached = await offlineDB.getAllFromCache("teacher_timetable", { class_id: selectedClassId });
      if (cached.length) {
        setTimetable(cached as unknown as TimetableEntry[]);
        toast.info("Showing the saved timetable. Changes will sync when you are online.");
      } else {
        toast.error("Failed to load timetable");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, isDemo, setLoading, setTimetable, toast, school?.id]);

  // Fetch ALL class timetables for the school to enable cross-class conflict detection
  // Note: depends only on school?.id, not classes array (to avoid re-render loops)
  const fetchAllTimetables = useCallback(async () => {
    if (isDemo) {
      setAllClassTimetables(
        mapDemoTimetable().map(
          ({ id, teacher_id, day_of_week, period_number, class_id, start_time, end_time, subject_id, subjects }) => ({
            id,
            teacher_id,
            day_of_week,
            period_number,
            class_id,
            start_time,
            end_time,
            room: null,
            subject_id: subject_id || null,
            subjects: subjects || null,
          }),
        ),
      );
      return;
    }
    if (!school?.id) return;
    try {
      const result = await withTimeout(
        supabase
          .from("teacher_timetable")
          .select(
            "id, teacher_id, day_of_week, period_number, class_id, start_time, end_time, room, subject_id, subjects(name, code)",
          ),
        10000,
        timeoutFallback(),
      );
      if (isTimeoutResult(result)) return;
      const { data, error } = result ?? {};
      if (error) throw error;
      const rows = (data || [])
        .filter((entry) => classIds.has(entry.class_id))
        .map((entry) => ({
          ...entry,
          school_id: school.id,
        }));
      setAllClassTimetables(rows);
      await offlineDB.cacheFromServer("teacher_timetable", rows as unknown as Record<string, unknown>[]);
    } catch (err) {
      logger.error("Error fetching all timetables:", err);
      const cached = await offlineDB.getAllFromCache("teacher_timetable");
      const schoolRows = cached.filter((row) => classIds.has(String(row.class_id)));
      if (schoolRows.length) setAllClassTimetables(schoolRows as unknown as AllClassTimetableEntry[]);
    }
  }, [school?.id, isDemo, classIds]);

  useEffect(() => {
    if (selectedClassId) fetchTimetable();
  }, [selectedClassId, fetchTimetable]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    fetchAllTimetables();
  }, [fetchAllTimetables]);

  /**
   * Detect conflicts for a proposed entry:
   * 1. Teacher double-booked: same teacher, same day, overlapping time in a DIFFERENT class
   * 2. Slot already filled: same class already has an entry at this day+period_number
   * 3. Room double-booked: same room, same day, overlapping time
   */
  const detectConflicts = useCallback(
    (
      teacherId: string,
      day: number,
      periodNumber: number,
      startTime: string,
      endTime: string,
      room?: string,
    ): string[] => {
      const found: string[] = [];

      // Check if the teacher is already teaching another class at an overlapping time
      const teacherConflict = allClassTimetables.find(
        (t) =>
          t.teacher_id === teacherId &&
          t.day_of_week === day &&
          t.class_id !== selectedClassId &&
          t.start_time < endTime &&
          t.end_time > startTime,
      );
      if (teacherConflict) {
        const conflictClass = classes.find((c) => c.id === teacherConflict.class_id);
        found.push(`Teacher is already scheduled in ${conflictClass?.name || "another class"} at an overlapping time`);
      }

      // Check if this class already has an entry at this slot
      const classConflict = timetable.find((t) => t.day_of_week === day && t.period_number === periodNumber);
      if (classConflict) {
        found.push(`This slot is already occupied by ${classConflict.subjects?.name || "another subject"}`);
      }

      // Check room double-booking
      if (room && room.trim()) {
        const roomConflict = allClassTimetables.find(
          (t) =>
            t.room !== null &&
            t.room.toLowerCase() === room.toLowerCase() &&
            t.day_of_week === day &&
            t.start_time < endTime &&
            t.end_time > startTime,
        );
        if (roomConflict) {
          const conflictClass = classes.find((c) => c.id === roomConflict.class_id);
          found.push(
            `Room "${room}" is already booked for ${conflictClass?.name || "another class"} at an overlapping time`,
          );
        }
      }

      // Check for overload (Scenario 20)
      const teacherPeriods = allClassTimetables.filter((t) => t.teacher_id === teacherId).length;
      if (teacherPeriods >= 25) {
        found.push(`Warning: Teacher already has ${teacherPeriods} periods assigned (Overload threshold is 25)`);
      }

      return found;
    },
    [allClassTimetables, timetable, selectedClassId, classes],
  );

  // Compute all clashes across the entire school timetable for the banner
  const clashes = useMemo(() => {
    const result: ClashInfo[] = [];
    const entries = allClassTimetables;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.day_of_week !== b.day_of_week) continue;
        if (!(a.start_time < b.end_time && a.end_time > b.start_time)) continue;

        // Teacher double-booking
        if (a.teacher_id === b.teacher_id && a.class_id !== b.class_id) {
          const classA = classes.find((c) => c.id === a.class_id)?.name || "Unknown";
          const classB = classes.find((c) => c.id === b.class_id)?.name || "Unknown";
          result.push({
            type: "teacher",
            description: `${staffNameById[a.teacher_id] || teacherNameById[a.teacher_id] || "Teacher"} double-booked: ${classA} ↔ ${classB} on ${DAYS.find((d) => d.value === a.day_of_week)?.full}`,
            day: a.day_of_week,
          });
        }

        // Room double-booking
        if (a.room && b.room && a.room.toLowerCase() === b.room.toLowerCase() && a.class_id !== b.class_id) {
          const classA = classes.find((c) => c.id === a.class_id)?.name || "Unknown";
          const classB = classes.find((c) => c.id === b.class_id)?.name || "Unknown";
          result.push({
            type: "room",
            description: `Room "${a.room}" double-booked: ${classA} ↔ ${classB} on ${DAYS.find((d) => d.value === a.day_of_week)?.full}`,
            day: a.day_of_week,
          });
        }
      }
    }
    const unique = new Map<string, ClashInfo>();
    for (const clash of result) unique.set(`${clash.type}:${clash.description}`, clash);
    return [...unique.values()];
  }, [allClassTimetables, classes, staffNameById, teacherNameById]);
  const globalClashes = clashes;

  const handleTeacherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teacherId = e.target.value;
    if (!teacherId || !selectedSlot) {
      setConflicts([]);
      return;
    }
    const found = detectConflicts(
      teacherId,
      selectedDay,
      selectedSlot.order_number ?? selectedSlot.period_number,
      selectedSlot.start_time,
      selectedSlot.end_time,
      roomValue,
    );
    setConflicts(found);
  };

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return;
    const formData = new FormData(e.currentTarget);
    const teacherId = formData.get("teacher_id") as string;
    const room = (formData.get("room") as string) || "";

    // Run conflict check one final time before saving
    const found = detectConflicts(
      teacherId,
      selectedDay,
      selectedSlot.order_number ?? selectedSlot.period_number,
      selectedSlot.start_time,
      selectedSlot.end_time,
      room,
    );
    const realConflicts = found.filter((c) => !c.startsWith("Warning:"));
    if (realConflicts.length > 0) {
      toast.error(`Cannot save: ${realConflicts[0]}`);
      return;
    }

    const entryData = {
      class_id: selectedClassId,
      subject_id: formData.get("subject_id"),
      teacher_id: teacherId,
      day_of_week: selectedDay,
      period_number: selectedSlot.order_number ?? selectedSlot.period_number,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      room: room || null,
      academic_year: new Date().getFullYear().toString(),
    };

    if (!entryData.class_id || !entryData.subject_id || !entryData.teacher_id) {
      toast.error("Class, subject, and teacher are required");
      return;
    }

    try {
      if (!isOnline) {
        const saved = await offlineDB.save("teacher_timetable", {
          ...entryData,
          school_id: school?.id,
          subjects: subjects.find((subject) => subject.id === entryData.subject_id) || null,
        });
        setTimetable((current) => [...current, saved as unknown as TimetableEntry]);
        toast.success("Timetable entry saved on this device. It will sync when you reconnect.");
      } else {
        const { error } = await supabase.from("teacher_timetable").insert([entryData]);
        if (error) throw error;
        toast.success("Timetable entry added");
      }
      setShowEntryModal(false);
      setConflicts([]);
      fetchTimetable();
      fetchAllTimetables();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to add timetable entry"));
    }
  };

  const handleDeleteEntry = async () => {
    if (!pendingDeleteEntryId) return;
    const entryId = pendingDeleteEntryId;
    setPendingDeleteEntryId(null);
    try {
      if (!isOnline) {
        await offlineDB.delete("teacher_timetable", entryId);
        setTimetable((current) => current.filter((entry) => entry.id !== entryId));
        toast.success("Entry removed on this device. The change will sync when you reconnect.");
      } else {
        const { error } = await supabase.from("teacher_timetable").delete().eq("id", entryId);
        if (error) throw error;
        toast.success("Entry removed");
      }
      fetchTimetable();
      fetchAllTimetables();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove timetable entry"));
    }
  };

  const handleBulkTimetableFile = async (file?: File) => {
    if (!file) return;
    setBulkImportSource("csv");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      toast.error("Add a header row and at least one lesson row to the CSV file.");
      return;
    }
    const split = (line: string) => (line.includes("\t") ? line.split("\t") : line.split(","));
    const headers = split(lines[0]).map((value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
    );
    const index = (...names: string[]) =>
      headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
    const col = {
      day: index("day", "weekday"),
      period: index("period", "lesson_number"),
      class: index("class", "stream"),
      subject: index("subject", "learning_area"),
      teacher: index("teacher", "staff"),
      start: index("start", "from"),
      end: index("end", "to"),
      room: index("room", "venue"),
    };
    if (
      Object.values(col)
        .slice(0, 7)
        .some((value) => value < 0)
    ) {
      toast.error("CSV needs columns for day, period, class, subject, teacher, start time and end time.");
      return;
    }
    const dayNumber = (value: string) => {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 1 && n <= 7) return n;
      return DAYS.find((day) => day.full.toLowerCase() === value.trim().toLowerCase())?.value ?? 0;
    };
    const match = (items: Array<{ id: string; name?: string; full_name?: string }>, value: string) =>
      items.find((item) => (item.name || item.full_name || "").trim().toLowerCase() === value.trim().toLowerCase())
        ?.id || "";
    const rows = lines.slice(1).map((line) => {
      const values = split(line).map((value) => value.trim());
      const get = (at: number) => (at >= 0 ? values[at] || "" : "");
      const classId = match(classes as any, get(col.class));
      const subjectId = match(subjects as any, get(col.subject));
      const teacherId = match(teachers as any, get(col.teacher));
      const day = dayNumber(get(col.day));
      const period = Number(get(col.period));
      const slot = effectiveSlots.find((item) => item.order_number === period || item.period_number === period);
      return {
        day_of_week: day,
        period_number: period,
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        start_time: get(col.start) || slot?.start_time || "",
        end_time: get(col.end) || slot?.end_time || "",
        room: get(col.room) || null,
      };
    });
    setBulkRows(rows);
    setShowBulkImport(true);
  };

  const handleTimetableImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a timetable photo or image file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("This image is over 12 MB. Resize or crop it, then try again.");
      return;
    }
    setOcrBusy(true);
    setOcrProgress("Preparing image…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        workerPath: "/vendor/tesseract/worker.min.js",
        corePath: "/vendor/tesseract",
        langPath: "/vendor/tesseract/tessdata",
        logger: (message) => {
          if (message.status === "recognizing text")
            setOcrProgress(`Reading timetable… ${Math.round(message.progress * 100)}%`);
          else if (message.status === "loading language traineddata") setOcrProgress("Loading offline OCR language…");
        },
      });
      try {
        const result = await worker.recognize(file);
        const drafts = parseTimetableOcrText(result.data.text);
        if (!drafts.length) {
          toast.error("No lesson rows were recognised. Try a clearer, straight-on photo or use CSV import.");
          return;
        }
        const dayNumber = (value: string) => {
          const normalized = value.toLowerCase();
          return (
            DAYS.find((day) => day.full.toLowerCase() === normalized || day.label.toLowerCase() === normalized)
              ?.value ?? 0
          );
        };
        const match = (items: Array<{ id: string; name?: string; full_name?: string }>, value: string) =>
          items.find((item) => (item.name || item.full_name || "").trim().toLowerCase() === value.trim().toLowerCase())
            ?.id || "";
        setBulkRows(
          drafts.map((row) => {
            const period = Number(row.period) || 0;
            const slot = effectiveSlots.find((item) => item.order_number === period || item.period_number === period);
            return {
              day_of_week: dayNumber(row.day),
              period_number: period,
              class_id: match(classes as any, row.className),
              subject_id: match(subjects as any, row.subject),
              teacher_id: match(teachers as any, row.teacher),
              start_time: row.startTime || slot?.start_time || "",
              end_time: row.endTime || slot?.end_time || "",
              room: row.room || null,
            };
          }),
        );
        setBulkImportSource("image");
        setShowBulkImport(true);
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      logger.error("Timetable image OCR failed", error);
      toast.error("Could not read this image. Check that the OCR assets are available, or use CSV import.");
    } finally {
      setOcrBusy(false);
      setOcrProgress("");
    }
  };

  const confirmBulkImport = async () => {
    const invalid = bulkRows.find(
      (row) =>
        !row.day_of_week ||
        !row.class_id ||
        !row.subject_id ||
        !row.teacher_id ||
        !row.start_time ||
        !row.end_time ||
        row.period_number < 1,
    );
    if (invalid) {
      toast.error("Some rows could not be matched. Fix the CSV names and times, then select the file again.");
      return;
    }
    try {
      const payload = bulkRows.map((row) => ({
        ...row,
        academic_year: academicYear || String(new Date().getFullYear()),
      }));
      const { error } = await supabase.from("teacher_timetable").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} timetable lessons imported.`);
      setShowBulkImport(false);
      setBulkRows([]);
      await Promise.all([fetchTimetable(), fetchAllTimetables()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not import timetable rows. Check your scheduling permissions."));
    }
  };

  const updateBulkRow = (index: number, patch: Partial<(typeof bulkRows)[number]>) =>
    setBulkRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));

  const getEntry = (day: number, periodNumber: number) => {
    return timetable.find((t) => t.day_of_week === day && t.period_number === periodNumber);
  };

  const openEntryModal = (day: number, slot: Slot) => {
    setSelectedSlot(slot);
    setSelectedDay(day);
    setConflicts([]);
    setRoomValue("");
    setShowEntryModal(true);
  };

  const dayTabs = DAYS.map((day) => ({ id: day.value.toString(), label: day.full }));
  const mainTabs = [
    { id: "timetable", label: "Class Timetable" },
    { id: "wall", label: "Wall Chart" },
    { id: "calendar", label: "Term Calendar" },
    { id: "fc", label: "Week View" },
  ];
  // Open on the actionable class timetable. The wall chart remains available
  // as a separate view and is much less usable as the default on a phone.
  const [mainTab, setMainTab] = useState<"timetable" | "wall" | "calendar" | "fc">("timetable");

  if (loadingSlots) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader title="Timetable" subtitle="Loading configuration..." />
        <Card>
          <TableSkeleton rows={6} />
        </Card>
      </div>
    );
  }

  // If slots failed to load (empty after loading), show a usable empty
  // timetable rather than a broken UI. Use the Ugandan lower-secondary
  // standard so the fallback is not the old six-period day.
  const effectiveSlots: Slot[] =
    slots.length > 0
      ? slots
      : buildSchoolDay(SCHOOL_DAY_PRESETS.lower_secondary).map((slot) => ({
          id: `fallback-${slot.order_number}`,
          name: slot.name,
          start_time: slot.start_time,
          end_time: slot.end_time,
          order_number: slot.order_number,
          is_break: !slot.is_lesson,
          is_lesson: slot.is_lesson,
        }));

  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId);
  const selectedLevel = schoolLevelFromClassName(selectedClass?.name);
  const seniorClassMatch = (selectedClass?.name ?? "").match(/S\s*\.?\s*([1-6])/i);
  const seniorClass = seniorClassMatch ? (Number(seniorClassMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6) : undefined;
  const weeklyTargets = weeklyPeriodTargets(
    selectedLevel,
    seniorClass && seniorClass <= 4 ? (seniorClass as 1 | 2 | 3 | 4) : undefined,
  );
  // Only compare subjects the school actually offers; the NCDC table lists
  // alternatives (General Science vs the three separate sciences) that a
  // given school does not teach side by side.
  const offeredTargets = weeklyTargets.filter((target) =>
    subjects.some((subject) => matchWeeklyTarget(subject.name) === target.subject),
  );
  const weeklyLoad = (offeredTargets.length > 0 ? offeredTargets : weeklyTargets).map((target) => ({
    ...target,
    actual: timetable.filter((entry) => {
      const subjectName = entry.subjects?.name ?? subjects.find((s) => s.id === entry.subject_id)?.name;
      return matchWeeklyTarget(subjectName) === target.subject;
    }).length,
  }));
  const weeklyPlanned = weeklyLoad.reduce((sum, row) => sum + row.actual, 0);
  const weeklyBelow = weeklyLoad.filter((row) => row.actual < row.periods).length;

  const selectedDayInfo = DAYS.find((day) => day.value === selectedDay);
  const dayLessonSlots = effectiveSlots.filter((slot) => !(slot.is_break ?? slot.is_lesson === false));
  const scheduledLessons = timetable.filter((entry) => entry.day_of_week === selectedDay).length;

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Timetable"
          subtitle="Class schedule and academic calendar"
          actions={
            <div className="flex flex-wrap gap-2">
              {canAutoGenerate && (
                <>
                  <Button variant="outline" onClick={() => bulkFileRef.current?.click()}>
                    Import CSV
                  </Button>
                  <Button variant="outline" onClick={() => timetableImageRef.current?.click()} disabled={ocrBusy}>
                    {ocrBusy ? ocrProgress || "Reading image…" : "Import timetable photo"}
                  </Button>
                </>
              )}
              <VideoLessonButton lesson="timetable" label="Watch how" />
              <input
                ref={bulkFileRef}
                type="file"
                accept=".csv,text/csv,.tsv,text/tab-separated-values"
                className="hidden"
                onChange={(event) => {
                  void handleBulkTimetableFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <input
                ref={timetableImageRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  void handleTimetableImage(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          }
        />

        <StatStrip
          columns={5}
          items={[
            { label: "Periods", value: effectiveSlots.filter((slot) => slot.is_lesson !== false).length, tone: "info" },
            { label: "Classes", value: classes.length },
            { label: "Subjects", value: subjects.length },
            { label: "Staff", value: teachers.length, tone: "warning" },
            { label: "Lessons", value: timetable.length, hint: selectedClass?.name || "selected class" },
          ]}
        />

        {slots.length > 0 && (slots[slots.length - 1]?.end_time ?? "") < "15:00" && canAutoGenerate && (
          <div className="rounded-2xl border border-[var(--amber-soft)] bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--amber-ink)]">
            This school still uses the old short day (ends around {slots[slots.length - 1]?.end_time}). Ugandan schools
            run 08:00–17:00 with 8 lessons.{" "}
            <button type="button" onClick={() => setShowDaySetup(true)} className="font-semibold underline">
              Update to the Ugandan school day
            </button>
          </div>
        )}

        {/* Main tabs: Class Timetable vs Term Calendar */}
        <div className="border-b border-[var(--border)] overflow-x-auto no-scrollbar">
          <Tabs
            tabs={mainTabs}
            activeTab={mainTab}
            onChange={(id) => setMainTab(id as "timetable" | "wall" | "calendar" | "fc")}
          />
        </div>

        <TabPanel activeTab={mainTab} tabId="wall">
          <KikunyuWallTimetable
            schoolName={school?.name}
            classes={classes as any}
            entries={allClassTimetables as any}
            slots={effectiveSlots as any}
            teacherNames={staffNameById}
          />
        </TabPanel>

        <TabPanel activeTab={mainTab} tabId="calendar">
          <TermCalendar schoolId={school?.id || ""} userId={user?.id || ""} />
        </TabPanel>

        <TabPanel activeTab={mainTab} tabId="fc">
          <TimetableCalendar timetable={timetable} slots={effectiveSlots as any} />
        </TabPanel>

        <TabPanel activeTab={mainTab} tabId="timetable">
          <div
            aria-label="timetable overview"
            className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm md:hidden"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--t3)]">Day overview</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-[var(--t1)]">
                  {selectedDayInfo?.full || "Class timetable"}
                </h2>
                <p className="mt-0.5 truncate text-sm text-[var(--t3)]">{selectedClass?.name || "Select a class"}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-right">
                <p className="text-lg font-bold leading-none text-[var(--primary)]">
                  {scheduledLessons}/{dayLessonSlots.length}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--t3)]">Lessons</p>
              </div>
            </div>
          </div>
          {globalClashes.length > 0 && (
            <div className="rounded-2xl border border-[var(--red-soft)] bg-[var(--red-soft)] p-4">
              <div className="flex items-start gap-3">
                <MaterialIcon icon="error" className="text-[var(--red-ink)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--red-ink)]">
                    {globalClashes.length} clash{globalClashes.length > 1 ? "es" : ""} detected in timetable
                  </p>
                  <p className="mt-1 text-xs text-[var(--red-ink)]/80">
                    Teachers or rooms are double-booked across classes. Re-run Auto-generate after fixing assignments,
                    or edit the affected periods.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(showAllClashes ? globalClashes : globalClashes.slice(0, 8)).map((clash, i) => (
                      <li key={i} className="text-xs text-[var(--red-ink)] flex items-start gap-2">
                        <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-[var(--red-ink)]" />
                        {clash.description}
                      </li>
                    ))}
                  </ul>
                  {globalClashes.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllClashes((v) => !v)}
                      className="mt-2 text-xs font-semibold text-[var(--red-ink)] underline"
                    >
                      {showAllClashes ? "Show fewer" : `Show all ${globalClashes.length} clashes`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {weeklyLoad.length > 0 && selectedClassId && (
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--t3)]">NCDC weekly load</p>
                  <p className="mt-0.5 text-sm text-[var(--t3)]">
                    {weeklyPlanned} periods a week across these subjects for {selectedClass?.name}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    weeklyBelow > 0
                      ? "bg-[var(--amber-soft)] text-[var(--amber-ink)]"
                      : "bg-[var(--primary)]/10 text-[var(--primary)]"
                  }`}
                >
                  {weeklyBelow > 0 ? `${weeklyBelow} below NCDC guide` : "All at NCDC guide"}
                </span>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {weeklyLoad.map((row) => {
                  const pct = Math.min(100, Math.round((row.actual / Math.max(row.periods, 1)) * 100));
                  const short = row.actual < row.periods;
                  return (
                    <div key={row.subject} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-xs font-medium text-[var(--t2)]">{row.subject}</span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                        <span
                          className={`block h-full rounded-full ${short ? "bg-[var(--amber)]" : "bg-[var(--primary)]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span
                        className={`w-12 shrink-0 text-right text-xs font-bold tabular-nums ${
                          short ? "text-[var(--amber-ink)]" : "text-[var(--primary)]"
                        }`}
                      >
                        {row.actual}/{row.periods}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {selectedClassId && !loading && timetable.length === 0 && (
            <EmptyState
              icon="calendar_view_week"
              title="No lessons scheduled yet"
              description="Auto-generate a full week from teacher–subject assignments, or tap a period to assign a lesson."
              action={
                canAutoGenerate ? { label: "Auto-generate", onClick: () => setShowGenerateModal(true) } : undefined
              }
              owlyQuestion="How do I build a class timetable?"
            />
          )}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              {classes.length === 0 ? (
                <div className="rounded-xl border border-[var(--amber)]/20 bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--amber-ink)]">
                  No classes available
                </div>
              ) : (
                <label className="block w-full sm:max-w-xs">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                    Timetable class
                  </span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="input h-10 text-sm font-medium"
                  >
                    <option value="">Select a class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {selectedClassId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPrint(true)}
                    icon={<MaterialIcon icon="print" className="text-lg" />}
                  >
                    Print
                  </Button>
                )}
                {canAutoGenerate && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDaySetup(true)}
                      icon={<MaterialIcon icon="schedule" className="text-lg" />}
                    >
                      School day
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowGenerateModal(true)}>
                      <span className="inline-flex items-center gap-2">
                        <MaterialIcon icon="auto_awesome" className="text-lg" /> Auto-generate
                      </span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="border-b border-[var(--border)]">
              <Tabs tabs={dayTabs} activeTab={selectedDay.toString()} onChange={(id) => setSelectedDay(parseInt(id))} />
            </div>

            {loading ? (
              <TableSkeleton rows={6} />
            ) : (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {effectiveSlots.map((slot) => {
                    const isBreak = slot.is_break ?? slot.is_lesson === false;
                    const entry = getEntry(selectedDay, slot.order_number ?? slot.period_number);
                    const time = `${slot.start_time?.slice(0, 5)} – ${slot.end_time?.slice(0, 5)}`;

                    if (isBreak) {
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center gap-3 rounded-xl bg-[var(--surface-container-low)] px-3 py-2.5"
                        >
                          <span className="w-14 shrink-0 text-xs font-medium text-[var(--t4)]">{time}</span>
                          <span className="h-px flex-1 bg-[var(--border)]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--t4)]">
                            {slot.name}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={slot.id} className="flex items-stretch gap-3">
                        <div className="flex w-14 shrink-0 flex-col justify-center text-xs font-medium leading-4 text-[var(--t4)]">
                          <span>{slot.start_time?.slice(0, 5)}</span>
                          <span>{slot.end_time?.slice(0, 5)}</span>
                        </div>
                        {entry ? (
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/10 p-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                                {entry.subjects?.code || "SUB"} · {slot.name}
                              </p>
                              <p className="mt-1 truncate text-sm font-semibold text-[var(--t1)]">
                                {entry.subjects?.name || "Lesson"}
                              </p>
                              <p className="mt-1 truncate text-xs text-[var(--t3)]">
                                {teacherNameById[entry.teacher_id] || "Teacher"}
                                {entry.room ? ` · ${entry.room}` : ""}
                              </p>
                            </div>
                            {canEditTimetable && (
                              <button
                                onClick={() => setPendingDeleteEntryId(entry.id)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--red-ink)] hover:bg-[var(--red-soft)]"
                                title="Remove entry"
                                aria-label={`Remove ${entry.subjects?.name || "lesson"}`}
                              >
                                <MaterialIcon icon="delete" className="text-lg" />
                              </button>
                            )}
                          </div>
                        ) : selectedClassId && canEditTimetable ? (
                          <button
                            onClick={() => openEntryModal(selectedDay, slot)}
                            className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm text-[var(--t3)] transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-[var(--primary)]">
                              <MaterialIcon icon="add" />
                            </span>
                            <span>
                              <span className="block font-semibold text-[var(--t2)]">Add lesson</span>
                              <span className="block text-xs text-[var(--t4)]">{slot.name}</span>
                            </span>
                          </button>
                        ) : (
                          <div className="flex min-h-16 flex-1 items-center rounded-xl border border-dashed border-[var(--border)] px-3 text-sm text-[var(--t4)]">
                            Select a class to view periods
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  {DAYS.map((day) => (
                    <TabPanel key={day.value} activeTab={selectedDay.toString()} tabId={day.value.toString()}>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="p-4 bg-[var(--surface-container-low)] border-b border-r border-[var(--border)] text-[var(--t4)] text-xs uppercase font-bold w-32 text-left">
                              Period
                            </th>
                            <th className="p-4 bg-[var(--surface-container-low)] border-b border-r border-[var(--border)] text-[var(--t1)] font-semibold text-left">
                              {day.full}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveSlots.map((slot) => {
                            const isBreak = slot.is_break ?? slot.is_lesson === false;
                            const entry = getEntry(day.value, slot.order_number ?? slot.period_number);
                            return (
                              <tr key={slot.id} className={isBreak ? "bg-[var(--surface-container-low)]/50" : ""}>
                                <td className="p-4 border-b border-r border-[var(--border)]">
                                  <p className="text-sm font-semibold text-[var(--t1)]">{slot.name}</p>
                                  <p className="text-xs text-[var(--t4)]">
                                    {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                                  </p>
                                </td>
                                <td
                                  className={`p-2 border-b border-[var(--border)] min-h-[100px] relative ${isBreak ? "opacity-50" : ""}`}
                                >
                                  {entry ? (
                                    <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-3 h-full group">
                                      <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-1">
                                        {entry.subjects?.code || "SUB"}
                                      </p>
                                      <p className="text-sm font-semibold text-[var(--t1)] leading-tight mb-2">
                                        {entry.subjects?.name}
                                      </p>
                                      <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-1.5 text-xs text-[var(--t4)]">
                                            <MaterialIcon icon="person" className="text-sm" />
                                            {teacherNameById[entry.teacher_id] || "Teacher"}
                                          </div>
                                          {entry.room && (
                                            <div className="flex items-center gap-1.5 text-xs text-[var(--t4)]">
                                              <MaterialIcon icon="location_on" className="text-sm" />
                                              {entry.room}
                                            </div>
                                          )}
                                        </div>
                                        {canEditTimetable && (
                                          <button
                                            type="button"
                                            onClick={() => setPendingDeleteEntryId(entry.id)}
                                            aria-label="Remove timetable entry"
                                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 p-1 hover:bg-[var(--red-soft)] rounded text-[var(--red-ink)] transition-all"
                                            title="Remove entry"
                                          >
                                            <MaterialIcon icon="delete" className="text-sm" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    !isBreak &&
                                    selectedClassId &&
                                    canEditTimetable && (
                                      <button
                                        onClick={() => openEntryModal(day.value, slot)}
                                        className="w-full h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 rounded-xl transition-all"
                                      >
                                        <MaterialIcon
                                          icon="add"
                                          className="text-[var(--t4)] hover:text-[var(--primary)]"
                                        />
                                      </button>
                                    )
                                  )}
                                  {isBreak && (
                                    <div className="flex items-center justify-center text-xs font-bold text-[var(--t4)] uppercase tracking-[0.2em]">
                                      {slot.name}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TabPanel>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Modal
            isOpen={showEntryModal && Boolean(selectedSlot)}
            onClose={() => {
              setShowEntryModal(false);
              setConflicts([]);
              setRoomValue("");
            }}
            title="Assign Lesson"
            size="md"
          >
            {selectedSlot && (
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="rounded-xl bg-[var(--primary)]/10 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-[var(--primary)]">Schedule Slot</p>
                  <p className="text-sm font-medium text-[var(--t1)]">
                    {DAYS.find((d) => d.value === selectedDay)?.full} · {selectedSlot.name} (
                    {selectedSlot.start_time?.slice(0, 5)} – {selectedSlot.end_time?.slice(0, 5)})
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Subject</label>
                  <select name="subject_id" required className="input">
                    <option value="">Choose subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Teacher</label>
                  <select name="teacher_id" required onChange={handleTeacherChange} className="input">
                    <option value="">Select teacher...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
                    Room (optional)
                  </label>
                  <input
                    name="room"
                    value={roomValue}
                    onChange={(e) => {
                      setRoomValue(e.target.value);
                      const teacherSelect =
                        e.currentTarget.form?.querySelector<HTMLSelectElement>('[name="teacher_id"]');
                      if (teacherSelect?.value && selectedSlot) {
                        const found = detectConflicts(
                          teacherSelect.value,
                          selectedDay,
                          selectedSlot.order_number ?? selectedSlot.period_number,
                          selectedSlot.start_time,
                          selectedSlot.end_time,
                          e.target.value,
                        );
                        setConflicts(found);
                      }
                    }}
                    placeholder="e.g. Lab 3, Room 12"
                    className="input"
                  />
                </div>

                {conflicts.length > 0 && (
                  <div className="space-y-2">
                    {conflicts.map((c, i) => {
                      const isWarning = c.startsWith("Warning:");
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${isWarning ? "border-[var(--amber-soft)] bg-[var(--amber-soft)] text-[var(--amber-ink)]" : "border-[var(--red-soft)] bg-[var(--red-soft)] text-[var(--red-ink)]"}`}
                        >
                          <MaterialIcon
                            icon="warning"
                            className={`mt-0.5 shrink-0 ${isWarning ? "text-[var(--amber-ink)]" : "text-[var(--red-ink)]"}`}
                          />
                          <span>{c}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button type="submit" className="mt-4 w-full" disabled={conflicts.length > 0}>
                  {conflicts.length > 0 ? "Resolve Conflicts First" : "Add to Timetable"}
                </Button>
              </form>
            )}
          </Modal>
        </TabPanel>
      </div>
      <ConfirmDialog
        isOpen={!!pendingDeleteEntryId}
        onClose={() => setPendingDeleteEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Remove Timetable Entry"
        message="Remove this timetable entry? This action cannot be undone."
        confirmLabel="Remove"
        variant="danger"
      />
      {showBulkImport && (
        <Modal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          title="Review timetable import"
          size="xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--t2)]">
              {bulkImportSource === "image"
                ? "Photo text was read on this device. OCR may misread table columns; check every field and correct unmatched values before importing."
                : "Review the matched class, subject and teacher for each lesson. Nothing is saved until you confirm."}
            </p>
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-[var(--surface-container-low)] text-[var(--t2)]">
                  <tr>
                    {["Day", "Period", "Class", "Subject", "Teacher", "Time", "Room"].map((label) => (
                      <th key={label} className="px-3 py-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.slice(0, 250).map((row, index) => {
                    const className = classes.find((item) => item.id === row.class_id)?.name || "Unmatched";
                    const subjectName = subjects.find((item) => item.id === row.subject_id)?.name || "Unmatched";
                    const teacherName = teachers.find((item) => item.id === row.teacher_id)?.full_name || "Unmatched";
                    const valid =
                      !!row.day_of_week &&
                      !!row.class_id &&
                      !!row.subject_id &&
                      !!row.teacher_id &&
                      !!row.start_time &&
                      !!row.end_time;
                    const cellClass =
                      "max-w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--t1)]";
                    return (
                      <tr
                        key={`${row.class_id}-${row.day_of_week}-${row.period_number}-${index}`}
                        className={valid ? "border-t border-[var(--border)]" : "border-t border-red-200 bg-red-50"}
                      >
                        <td className="px-2 py-2">
                          <select
                            aria-label={`Day for row ${index + 1}`}
                            className={cellClass}
                            value={row.day_of_week || ""}
                            onChange={(event) => updateBulkRow(index, { day_of_week: Number(event.target.value) })}
                          >
                            <option value="">Choose day</option>
                            {DAYS.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.full}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Period for row ${index + 1}`}
                            className={`${cellClass} w-20`}
                            type="number"
                            min="1"
                            value={row.period_number || ""}
                            onChange={(event) => updateBulkRow(index, { period_number: Number(event.target.value) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            aria-label={`Class for row ${index + 1}`}
                            className={cellClass}
                            value={row.class_id}
                            onChange={(event) => updateBulkRow(index, { class_id: event.target.value })}
                          >
                            <option value="">Choose class</option>
                            {classes.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                                {item.stream ? ` ${item.stream}` : ""}
                              </option>
                            ))}
                          </select>
                          <span className="sr-only">{className}</span>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            aria-label={`Subject for row ${index + 1}`}
                            className={cellClass}
                            value={row.subject_id}
                            onChange={(event) => updateBulkRow(index, { subject_id: event.target.value })}
                          >
                            <option value="">Choose subject</option>
                            {subjects.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <span className="sr-only">{subjectName}</span>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            aria-label={`Teacher for row ${index + 1}`}
                            className={cellClass}
                            value={row.teacher_id}
                            onChange={(event) => updateBulkRow(index, { teacher_id: event.target.value })}
                          >
                            <option value="">Choose teacher</option>
                            {teachers.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.full_name}
                              </option>
                            ))}
                          </select>
                          <span className="sr-only">{teacherName}</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <input
                              aria-label={`Start time for row ${index + 1}`}
                              type="time"
                              className={`${cellClass} w-28`}
                              value={row.start_time}
                              onChange={(event) => updateBulkRow(index, { start_time: event.target.value })}
                            />
                            <input
                              aria-label={`End time for row ${index + 1}`}
                              type="time"
                              className={`${cellClass} w-28`}
                              value={row.end_time}
                              onChange={(event) => updateBulkRow(index, { end_time: event.target.value })}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Room for row ${index + 1}`}
                            className={`${cellClass} w-24`}
                            value={row.room || ""}
                            onChange={(event) => updateBulkRow(index, { room: event.target.value || null })}
                            placeholder="Optional"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {bulkRows.length > 250 && (
                <p className="p-3 text-xs text-[var(--t3)]">
                  Showing first 250 of {bulkRows.length} rows. All rows are checked before import.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--t3)]">
                {bulkRows.length} rows ·{" "}
                {
                  bulkRows.filter(
                    (row) =>
                      row.day_of_week &&
                      row.class_id &&
                      row.subject_id &&
                      row.teacher_id &&
                      row.start_time &&
                      row.end_time,
                  ).length
                }{" "}
                ready
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBulkImport(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void confirmBulkImport()} disabled={!bulkRows.length}>
                  Import lessons
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {showGenerateModal && (
        <GenerateTimetableModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          schoolId={school?.id || ""}
          academicYear={new Date().getFullYear().toString()}
          subjects={subjects}
          level={selectedLevel}
          onApproved={() => {
            fetchTimetable();
            fetchAllTimetables();
          }}
        />
      )}
      <SchoolDaySetupModal
        isOpen={showDaySetup}
        onClose={() => setShowDaySetup(false)}
        schoolId={school?.id}
        classIds={classes.map((classItem) => classItem.id)}
        defaultLevel={selectedLevel}
        onApplied={() => {
          refetchSlots();
          fetchTimetable();
        }}
      />
      <TimetablePrintSheet
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        schoolName={school?.name}
        className={selectedClass?.name}
        academicYear={academicYear}
        termLabel={`Term ${currentTerm}`}
        slots={effectiveSlots}
        days={DAYS}
        entries={timetable}
        teacherNameById={teacherNameById}
      />
    </PageErrorBoundary>
  );
}
