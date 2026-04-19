"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="content">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-rounded text-red-500 text-2xl">warning</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--t1)] mb-2">Page Error</h2>
          <p className="text-sm text-[var(--t3)] mb-6">
            This page encountered an error. Your data is safe.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="btn btn-ghost text-sm"
            >
              Retry
            </button>
            <a href="/dashboard" className="btn btn-primary text-sm">
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
