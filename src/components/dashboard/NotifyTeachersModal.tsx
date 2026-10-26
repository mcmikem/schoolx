"use client";
import Link from "next/link";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { whatsappHref } from "@/lib/phone-links";

export interface NudgeClass {
  id: string;
  name: string;
  class_teacher_id?: string | null;
}

export interface NudgeStaff {
  id: string;
  full_name: string;
  phone?: string | null;
}

type NudgeKind = "attendance";

function reminderFor(kind: NudgeKind, className: string, schoolName: string, today: string): string {
  if (kind === "attendance") {
    return `Hello! Class ${className} — attendance for today (${today}) has not been marked yet. Please take it in SkoolMate when you have a moment. — ${schoolName}`;
  }
  return `Hello! Class ${className} — ${kind} is still pending. Please complete it in SkoolMate. — ${schoolName}`;
}

/**
 * A dashboard problem should carry its fix. This modal lists the classes
 * behind the alert, matches each to its class teacher, and opens a WhatsApp
 * chat with the reminder already typed — the headmaster just presses send.
 * Classes without an assigned teacher link straight to the assignment screen
 * instead of dead-ending.
 */
export default function NotifyTeachersModal({
  open,
  onClose,
  classes,
  staff,
  kind = "attendance",
  schoolName,
  staffLoading = false,
}: {
  open: boolean;
  onClose: () => void;
  classes: NudgeClass[];
  staff: NudgeStaff[];
  kind?: NudgeKind;
  schoolName?: string;
  staffLoading?: boolean;
}) {
  const today = useMemo(() => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" }), []);

  const rows = useMemo(() => {
    return classes.map((cls) => {
      const teacher = cls.class_teacher_id ? staff.find((s) => s.id === cls.class_teacher_id) : undefined;
      const firstName = teacher?.full_name?.split(" ")[0];
      const message = reminderFor(kind, cls.name, schoolName || "Your school", today);
      return {
        classId: cls.id,
        className: cls.name,
        teacherName: teacher?.full_name ?? null,
        teacherFirstName: firstName ?? null,
        phone: teacher?.phone ?? null,
        href: teacher?.phone ? whatsappHref(teacher.phone, message) : null,
      };
    });
  }, [classes, staff, kind, schoolName, today]);

  if (!open) return null;
  const contactable = rows.filter((r) => r.href).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Remind class teachers"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg)] shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--t1)]">Remind class teachers</h2>
            <p className="mt-0.5 text-xs text-[var(--t3)]">
              Opens WhatsApp with the message typed — you press send for each teacher.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container-low)]"
          >
            <MaterialIcon icon="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {staffLoading ? (
            <p className="p-3 text-center text-xs text-[var(--t3)]">Loading staff contacts…</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.classId}
                  className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--t1)]">{row.className}</p>
                    <p className="truncate text-xs text-[var(--t3)]">
                      {row.teacherName ? (row.teacherFirstName ?? row.teacherName) : "No teacher assigned"}
                    </p>
                  </div>
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      <MaterialIcon icon="chat" style={{ fontSize: 14 }} />
                      WhatsApp
                    </a>
                  ) : row.teacherName ? (
                    <span className="shrink-0 text-xs font-medium text-[var(--amber)]">No number saved</span>
                  ) : (
                    <Link
                      href="/dashboard/classes"
                      onClick={onClose}
                      className="shrink-0 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      Assign
                    </Link>
                  )}
                </li>
              ))}
              {rows.length === 0 && <p className="p-3 text-center text-xs text-[var(--t3)]">No classes found.</p>}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-center text-[11px] text-[var(--t3)]">
            {contactable > 0
              ? `${contactable} teacher${contactable === 1 ? "" : "s"} reachable on WhatsApp`
              : "No staff phone numbers saved yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
