"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { formatCurrency } from "@/lib/currency";

export interface PaymentStudentOption {
  id: string;
  name: string;
  balance: number;
  student_number?: string;
  class_name?: string;
}

export default function PaymentStudentSearch({
  students,
  value,
  onChange,
  error,
  disabled,
}: {
  students: PaymentStudentOption[];
  value: string;
  onChange: (studentId: string) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const inputId = useId();
  const listId = `${inputId}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = students.find((student) => student.id === value);
  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected?.id, selected?.name]);
  const matching = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return students.filter((student) => {
      const text = `${student.name} ${student.student_number || ""} ${student.class_name || ""}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [students, query]);
  const results = matching.slice(0, 8);
  const choose = (student: PaymentStudentOption) => {
    onChange(student.id);
    setQuery(student.name);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-[var(--t1)]">
        Student
      </label>
      <div className="relative">
        <MaterialIcon icon="search" className="pointer-events-none absolute left-3 top-3.5 text-lg text-[var(--t3)]" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-help`}
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder="Type a name, student number or class"
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onChange("");
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((previous) =>
                Math.max(0, Math.min(results.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1))),
              );
            } else if (event.key === "Enter" && open && results[activeIndex]) {
              event.preventDefault();
              choose(results[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
          className={`w-full rounded-xl border bg-[var(--surface)] py-3 pl-10 pr-4 text-base text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${error ? "border-[var(--red)]" : "border-[var(--border)]"}`}
        />
      </div>
      {open && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div id={listId} role="listbox" aria-label="Student search results" className="max-h-56 overflow-y-auto">
            {results.map((student, index) => (
              <button
                key={student.id}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(student)}
                className={`flex min-h-14 w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors ${index === activeIndex ? "bg-[var(--surface-container-low)]" : "hover:bg-[var(--surface-container-low)]"}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{student.name}</span>
                  <span className="block text-xs text-[var(--t3)]">
                    {[student.student_number, student.class_name].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--t2)]">
                  {formatCurrency(student.balance)}
                </span>
              </button>
            ))}
          </div>
          <p role="status" className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--t3)]">
            {matching.length === 0
              ? "No students match. Try another name or student number."
              : matching.length > 8
                ? `Showing 8 of ${matching.length} matches. Keep typing to narrow the list.`
                : `${matching.length} students found`}
          </p>
        </div>
      )}
      <p id={`${inputId}-help`} className="text-xs text-[var(--t3)]">
        Search, then choose the student receiving this payment.
      </p>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}
