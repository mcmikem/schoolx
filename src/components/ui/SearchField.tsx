"use client";

import { type Ref, useId } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export default function SearchField({ label, value, onChange, placeholder = "Search…", inputRef }: SearchFieldProps) {
  const id = useId();

  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[var(--t2)]">
        {label}
      </label>
      <div className="relative">
        <MaterialIcon
          icon="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
        />
        <input
          id={id}
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-12 text-sm text-[var(--t1)] [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={(event) => {
              onChange("");
              event.currentTarget.parentElement?.querySelector("input")?.focus();
            }}
            className="absolute right-0 top-0 flex h-full min-h-11 w-11 items-center justify-center rounded-r-xl text-[var(--t3)] hover:bg-[var(--surface-container)]"
          >
            <MaterialIcon icon="close" />
          </button>
        )}
      </div>
    </div>
  );
}
