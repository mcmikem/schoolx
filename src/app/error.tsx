"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorDetails } from "@/components/ErrorDetails";
import { recoverFromStaleBuild, retryStaleBuildOnce } from "@/lib/build-recovery";
import { logger } from "@/lib/logger";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    logger.error("[App Error]", error);
    Sentry.captureException(error);
    // A boot failure caused by a stale service-worker cache cannot be fixed by
    // reset(): the module graph is already broken. Clear the worker + caches
    // once and reload instead of leaving the user on this screen forever.
    void retryStaleBuildOnce(error);
  }, [error]);

  const clearCacheAndReload = async () => {
    setRecovering(true);
    await recoverFromStaleBuild();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-rounded text-red-500 text-3xl">error</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <ErrorDetails error={error} source="app-error" className="mb-6" />
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50"
          >
            Try Again
          </button>
          <button
            onClick={clearCacheAndReload}
            disabled={recovering}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            {recovering ? "Clearing…" : "Clear cache & reload"}
          </button>
          <Link href="/" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
