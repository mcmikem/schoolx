"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";

function formatModuleLabel(moduleName: string): string {
  return moduleName
    .split("-")
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NoAccessPage() {
  const params = useSearchParams();
  const reason = params.get("reason") || "permission";
  const from = params.get("from") || "/dashboard";
  const required = params.get("required") || "this section";
  const moduleName = params.get("module") || "feature";

  const summary = useMemo(() => {
    if (reason === "feature") {
      return {
        title: "Upgrade required",
        message: `Your current plan does not include ${formatModuleLabel(moduleName)}.`,
      };
    }
    return {
      title: "Access restricted",
      message: `Your account does not currently have permission for ${required}.`,
    };
  }, [reason, required, moduleName]);

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--sh2)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--amber-soft)] flex items-center justify-center mb-4">
          <MaterialIcon icon="lock" className="text-[var(--amber)] text-[22px]" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--t1)]">{summary.title}</h1>
        <p className="text-sm text-[var(--t2)] mt-2">{summary.message}</p>
        <p className="text-xs text-[var(--t3)] mt-2 break-words">Requested page: {from}</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[var(--primary)] text-white px-4 py-2.5 text-sm font-semibold text-center"
          >
            Go to Dashboard Home
          </Link>
          <Link
            href={reason === "feature" ? "/dashboard/settings?tab=subscription" : "/dashboard/settings"}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--t1)] text-center"
          >
            {reason === "feature" ? "View Upgrade Options" : "Review My Access"}
          </Link>
        </div>
      </div>
    </div>
  );
}
