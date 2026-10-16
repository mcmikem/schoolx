"use client";

import { RollCallPhoto } from "@/components/attendance/RollCallPhoto";
import { type SwipeAction, SwipeRow } from "@/components/attendance/SwipeRow";
import MaterialIcon from "@/components/MaterialIcon";

/**
 * One pupil in the roll, on a phone.
 *
 * Shaped after the grades page's mobile card — initials/photo, name, then the
 * thing to do — because that is the layout a teacher's thumb already knows.
 *
 * The reason it is a card and not a row: marking used to be a tap-to-cycle
 * gesture plus a 40px dot, which means knowing what a tap will do. Nobody should
 * have to learn a gesture to record that a child is in the room. The three
 * statuses are now printed on the card at thumb size, and the tap lands on the
 * status you wanted rather than the next one in a cycle.
 *
 * Swipe is kept, because it is genuinely faster once you have the rhythm — but
 * it is a shortcut over an explicit control, not the only way through.
 */

export interface AttendanceMarkCardProps {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    student_number?: string | null;
    photo_url?: string | null;
  };
  /** undefined means not yet marked. Never faked to "Present". */
  status?: string;
  onMark: (status: string) => void;
  /** Cycles forward on a plain tap of the card body. */
  onTapCycle: () => void;
  onFocus?: () => void;
  leftAction: SwipeAction;
  rightAction: SwipeAction;
  /** Required, not defaulted: the left swipe alternates between Late and
      Excused depending on the current mark, so the caller owns the mapping and
      the reveal still comes from the action descriptor it passes. */
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Briefly rings the card after a change, so the eye can find it again. */
  flash?: boolean;
  /** The statuses offered, in display order. */
  statuses: ReadonlyArray<{ key: string; label: string; icon: string; activeBg: string; activeText: string }>;
  /** Draws attention to the first row until the first mark is made. */
  peek?: boolean;
}

export function AttendanceMarkCard({
  student,
  status,
  onMark,
  onTapCycle,
  onFocus,
  leftAction,
  rightAction,
  onSwipeLeft,
  onSwipeRight,
  flash,
  statuses,
  peek,
}: AttendanceMarkCardProps) {
  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <SwipeRow
      id={`att-row-${student.id}`}
      onSwipeRight={onSwipeRight}
      onSwipeLeft={onSwipeLeft}
      onTap={onTapCycle}
      rightAction={rightAction}
      leftAction={leftAction}
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)] ${
        flash ? "ring-2 ring-[var(--primary)]" : ""
      } ${peek ? "animate-[swipe-peek_1.4s_ease-in-out_0.8s]" : ""}`}
    >
      <div className="flex items-center gap-3">
        <RollCallPhoto name={fullName} photoUrl={student.photo_url} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold text-[var(--t1)] text-[15px] leading-tight">{fullName}</p>
            {onFocus && (
              <button
                type="button"
                onClick={(event) => {
                  // The card's own tap marks a pupil; focusing one is a separate
                  // intent and must not also set their status.
                  event.stopPropagation();
                  onFocus();
                }}
                className="shrink-0 rounded-full p-1.5 text-[var(--t3)] hover:bg-[var(--surface-container-low)]"
                aria-label={`Open ${fullName} on their own screen`}
                title="Mark one pupil at a time"
              >
                <MaterialIcon icon="open_in_full" size={14} />
              </button>
            )}
          </div>
          <p className="truncate text-xs text-[var(--t3)]">{student.student_number}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}>
        {statuses.map((option) => {
          const active = status === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={(event) => {
                event.stopPropagation();
                onMark(option.key);
              }}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-xs font-bold transition-colors ${
                active
                  ? `${option.activeBg} ${option.activeText} border-transparent`
                  : "border-[var(--border)] bg-[var(--surface-container-lowest)] text-[var(--t3)]"
              }`}
            >
              <MaterialIcon icon={option.icon} size={18} />
              <span className="leading-none">{option.label}</span>
            </button>
          );
        })}
      </div>
    </SwipeRow>
  );
}
