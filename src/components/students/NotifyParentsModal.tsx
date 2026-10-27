"use client";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { whatsappHref } from "@/lib/phone-links";

export interface NotifyParentEntry {
  id: string;
  studentName: string;
  parentName?: string | null;
  phone?: string | null;
  className?: string | null;
}

/**
 * Bulk outreach to parents of selected pupils.
 *
 * Each row becomes a WhatsApp chat with the reminder already typed — the
 * headmaster presses send per parent (WhatsApp has no batch-send, and quiet
 * hours belong to the school). Parents without a saved number say so instead
 * of hiding; the row is still there so the gap is visible and fixable.
 *
 * `message` (optional) supplies the text to send. Leave it undefined for the
 * built-in reminder, or pass the composer's message to reuse the same rows
 * for ad-hoc class communication.
 */
export default function NotifyParentsModal({
  open,
  onClose,
  entries,
  schoolName,
  message,
  title,
}: {
  open: boolean;
  onClose: () => void;
  entries: NotifyParentEntry[];
  schoolName?: string;
  message?: string;
  title?: string;
}) {
  const today = useMemo(() => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" }), []);

  const rows = useMemo(() => {
    return entries.map((entry) => {
      const text =
        message ??
        (`Hello${entry.parentName ? ` ${entry.parentName.split(" ")[0]}` : ""}! ` +
          `${schoolName || "Our school"}: a reminder about ${entry.studentName}` +
          `${entry.className ? ` (${entry.className})` : ""} on ${today}. ` +
          `Kindly check the SkoolMate updates or reply here if there is anything to discuss. Thank you!`);
      return { ...entry, href: entry.phone ? whatsappHref(entry.phone, text) : null };
    });
  }, [entries, message, schoolName, today]);

  if (!open) return null;
  const reachable = rows.filter((r) => r.href).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Remind parents"}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg)] shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--t1)]">
              {title || `Message ${entries.length} parent${entries.length === 1 ? "" : "s"}`}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--t3)]">
              Opens WhatsApp with the message typed — you press send for each parent.
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
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[var(--t1)]">{row.studentName}</p>
                  {row.parentName?.trim() ? (
                    <p className="truncate text-xs text-[var(--t3)]">{row.parentName}</p>
                  ) : row.className ? (
                    <p className="truncate text-xs text-[var(--t3)]">{row.className}</p>
                  ) : null}
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
                ) : (
                  <span className="shrink-0 text-xs font-medium text-[var(--amber)]">No number saved</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-center text-[11px] text-[var(--t3)]">
            {reachable > 0
              ? `${reachable} of ${rows.length} parent${rows.length === 1 ? "" : "s"} reachable on WhatsApp`
              : "No phone numbers saved for these pupils yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
