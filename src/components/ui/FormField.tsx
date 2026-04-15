"use client";

import { forwardRef, useId } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  success?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, required, success, ...props }, ref) => {
    const id = useId();

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={id}
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            id={id}
            ref={ref}
            className={`w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors ${error ? "border-[var(--error)]" : ""}`}
            {...props}
          />
          {hint && (
            <p className="absolute -top-4 left-0 text-xs text-[var(--t4)]">
              {hint}
            </p>
          )}
          {error && <p className="mt-1 text-sm text-[var(--error)]">{error}</p>}
          {success && (
            <p className="mt-1 text-sm text-[var(--green)]">{success}</p>
          )}
        </div>
      </div>
    );
  },
);

FormField.displayName = "FormField";
