"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { t } from "@/i18n";
import { ErrorDetails } from "@/components/ErrorDetails";
import { APP_NAME } from "@/lib/app-name";
import { recoverFromStaleBuild, retryStaleBuildOnce } from "@/lib/build-recovery";
import { logger } from "@/lib/logger";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    logger.error("Application error:", error);
    Sentry.captureException(error);
    // A stale service worker can leave the document running the previous
    // deploy's HTML against the new chunks. reset() cannot repair that, so
    // clear the worker + caches and reload once.
    void retryStaleBuildOnce(error);
  }, [error]);

  const clearCacheAndReload = async () => {
    setRecovering(true);
    await recoverFromStaleBuild();
  };

  return (
    <html lang="en">
      <head>
        <title>{APP_NAME} - Error</title>
        <meta
          name="description"
          content={`An unexpected error occurred in ${APP_NAME}. Your Digital School Partner. Please try refreshing the page or contact support.`}
        />
        <meta property="og:title" content={`${APP_NAME} - Error`} />
        <meta property="og:description" content="An unexpected error occurred. Please try refreshing the page." />
        <meta property="og:type" content="website" />
      </head>
      <body>
        <a
          href="#error-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-gray-900 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
        >
          Skip to main content
        </a>
        <div
          id="error-content"
          tabIndex={-1}
          className="min-h-screen flex items-center justify-center p-8 bg-gray-50 focus:outline-none"
        >
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MaterialIcon icon="warning" size={32} className="h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t("error.somethingWentWrong")}</h2>
            <ErrorDetails error={error} source="global-error" className="mb-6" />
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={reset}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    reset();
                  }
                }}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors"
              >
                <MaterialIcon icon="refresh" size={16} className="h-4" /> {t("error.tryAgain")}
              </button>
              <button
                onClick={clearCacheAndReload}
                disabled={recovering}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <MaterialIcon icon="cleaning_services" size={16} className="h-4" />
                {recovering ? "Clearing…" : "Clear cache & reload"}
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <MaterialIcon icon="home" size={16} className="h-4" /> {t("error.goToDashboard")}
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
