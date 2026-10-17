"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { formatCurrency } from "@/lib/currency";

export interface StudentPickerOption {
  id: string;
  name: string;
  balance?: number;
  student_number?: string | null;
  class_name?: string | null;
}

interface StudentPickerProps {
  students: StudentPickerOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  /** Shown when nothing is chosen yet. */
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  /** Shown under the chosen pupil, e.g. what the number is worth. */
  renderMeta?: (student: StudentPickerOption) => string;
}

/**
 * A searchable pupil chooser.
 *
 * A native <select> of forty children is unusable: on a phone the list is a
 * full-screen scroller of near-identical names with no way to filter, and
 * "Nakato Sarah" and "Nakato Peter" are indistinguishable at a glance. This is
 * the same typeahead the payment form already uses for exactly this reason,
 * generalised so fee adjustments and any other form stop re-inventing a
 * dropdown.
 *
 * Matches on name or admission number, because staff know one or the other and
 * rarely both.
 */
export default function StudentPicker({
  students,
  value,
  onChange,
  label = "Student",
  placeholder = "Search by name or number…",
  disabled,
  error,
  required,
  renderMeta,
}: StudentPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => students.find((s) => s.id === value) ?? null, [students, value]);

  // Typing filters; the chosen pupil does not, so the field reads back as a name
  // rather than as the last thing typed.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.student_number ?? "").toLowerCase().includes(q),
    );
  }, [students, query]);

  // Close when tapping away, so the list does not float over the rest of the form.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // A new form should not arrive pre-filtered by whatever was last typed.
  useEffect(() => {
    if (selected) setQuery("");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (student: StudentPickerOption) => {
    onChange(student.id);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      // Only claim Enter when a choice is actually highlighted, so the field can
      // still be typed into without the form submitting on every keystroke.
      const pick = matches[highlight];
      if (open && pick) {
        event.preventDefault();
        choose(pick);
      }
      return;
    }
    if (event.key === "Escape") setOpen(false);
  };

  const meta = (student: StudentPickerOption) =>
    renderMeta ? renderMeta(student) : student.balance !== undefined ? formatCurrency(student.balance) : "";

  return (
    <div ref={boxRef} className="relative">
      <label
        className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--t3)] mb-2"
        htmlFor="student-picker-input"
      >
        {label}
        {required && <span className="text-[var(--red)] ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          id="student-picker-input"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="student-picker-list"
          autoComplete="off"
          value={selected ? selected.name : query}
          placeholder={selected ? "" : placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (selected) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`w-full rounded-xl py-3 pl-4 pr-11 text-sm bg-[var(--surface-container)] text-[var(--t1)] border ${
            error ? "border-2 border-[var(--red)]" : "border-transparent"
          }`}
        />
        {selected ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--t3)] hover:bg-[var(--surface-container-high)]"
            aria-label="Clear pupil"
          >
            <MaterialIcon icon="close" size={16} />
          </button>
        ) : (
          <MaterialIcon
            icon="search"
            size={18}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
          />
        )}
      </div>

      {open && !selected && (
        <ul
          id="student-picker-list"
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--t3)]">No pupil matches "{query.trim()}"</li>
          ) : (
            matches.map((student, index) => {
              const detail = meta(student);
              return (
                <li key={student.id} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(student)}
                    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm ${
                      index === highlight ? "bg-[var(--surface-container-low)]" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-[var(--t1)]">{student.name}</span>
                    {student.class_name && (
                      <span className="shrink-0 text-[11px] text-[var(--t3)]">{student.class_name}</span>
                    )}
                    {detail && <span className="shrink-0 text-xs font-semibold text-[var(--t3)]">{detail}</span>}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {/* Kept in the DOM so the name survives a submit without JS reading it,
          and so the field still has a value if the picker is cleared. */}
      {selected && <input type="hidden" name="student_id" value={selected.id} />}

      {error && <p className="mt-1 text-xs text-[var(--red)]">{error}</p>}
    </div>
  );
}
