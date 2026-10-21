"use client";
import MaterialIcon from "@/components/MaterialIcon";

export interface ClassMarkingStatus {
  classId: string;
  className: string;
  /** Pupils recorded in the register for this class today. */
  marked: number;
  /** Pupils in the class, so "12 of 40" can be said. */
  total: number;
  absent: number;
}

interface TodaysMarkingPanelProps {
  classes: ClassMarkingStatus[];
  dateLabel: string;
  onOpen: (classId: string) => void;
}

/**
 * Who has marked today.
 *
 * A headmaster's first question in the morning is not "what did I teach" --
 * it is "who has not marked yet". Every class registers at its own start
 * time, and a class that has not registered at all is invisible from the
 * headmaster's desk: the register only shows what exists.
 *
 * So this lists every class, marked or not. A class with no rows today is
 * "not marked yet", which is the thing worth knowing.
 */
export default function TodaysMarkingPanel({ classes, dateLabel, onOpen }: TodaysMarkingPanelProps) {
  if (classes.length === 0) return null;

  const marked = classes.filter((c) => c.marked > 0).length;
  const missing = classes.filter((c) => c.marked === 0);

  return (
    <section
      aria-label="Today's marking"
      className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-[var(--t1)]">Today&apos;s marking</h2>
        <span className="text-xs text-[var(--t3)]">
          {dateLabel} · {marked} of {classes.length} classes marked
        </span>
      </div>

      {missing.length > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--amber-soft,#fef3c7)] px-3 py-2 text-xs font-semibold text-[var(--amber-ink,#92400e)]">
          <MaterialIcon icon="schedule" style={{ fontSize: 16 }} />
          {missing.length === 1
            ? `${missing[0].className} has not marked yet`
            : `${missing.length} classes have not marked yet`}
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {classes.map((row) => {
          const done = row.marked > 0;
          return (
            <li key={row.classId}>
              <button
                type="button"
                onClick={() => onOpen(row.classId)}
                className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  done
                    ? "border-[var(--border)] bg-[var(--surface-container-lowest)]"
                    : "border-dashed border-[var(--amber)] bg-[var(--amber-soft,#fef3c7)]"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-[var(--green-soft,#dcfce7)] text-[var(--green,#16a34a)]"
                      : "bg-white/70 text-[var(--amber-ink,#92400e)]"
                  }`}
                >
                  <MaterialIcon icon={done ? "check_circle" : "schedule"} style={{ fontSize: 18 }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--t1)]">{row.className}</span>
                  <span className="block truncate text-xs text-[var(--t3)]">
                    {done ? `${row.marked} of ${row.total} recorded` : "Not marked yet"}
                    {row.absent > 0 ? ` · ${row.absent} absent` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
