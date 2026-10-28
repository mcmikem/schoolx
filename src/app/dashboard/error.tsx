"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorDetails } from "@/components/ErrorDetails";
import { OfflineErrorFallback } from "@/components/OfflineErrorFallback";
import { useOnlineStatus } from "@/lib/offline";
import { recoverFromStaleBuild, retryStaleBuildOnce } from "@/lib/build-recovery";
import { logger } from "@/lib/logger";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    logger.error("[Dashboard Error]", error);
    void retryStaleBuildOnce(error);
  }, [error]);

  const clearCacheAndReload = async () => {
    setRecovering(true);
    await recoverFromStaleBuild();
  };

  if (!isOnline) {
    return (
      <div className="content">
        <OfflineErrorFallback onRetry={reset} />
      </div>
    );
  }

  return (
    <div className="content">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-rounded text-red-500 text-2xl">warning</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--t1)] mb-2">Page Error</h2>
          <ErrorDetails error={error} source="dashboard-error" className="mb-6" />
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={reset} className="btn btn-ghost text-sm">
              Retry
            </button>
            <button onClick={clearCacheAndReload} disabled={recovering} className="btn btn-ghost text-sm">
              {recovering ? "Clearing…" : "Clear cache & reload"}
            </button>
            <Link href="/dashboard" className="btn btn-primary text-sm">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
