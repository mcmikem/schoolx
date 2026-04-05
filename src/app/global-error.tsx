"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { t } from "@/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>ASSEMBLE - Error</title>
        <meta
          name="description"
          content="An unexpected error occurred in ASSEMBLE. Powered by Omuto Foundation. Please try refreshing the page or contact support."
        />
        <meta property="og:title" content="ASSEMBLE - Error" />
        <meta
          property="og:description"
          content="An unexpected error occurred. Please try refreshing the page."
        />
        <meta property="og:type" content="website" />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t("error.somethingWentWrong")}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {t("error.unexpectedError")}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-4">
                {t("error.errorId")}: {error.digest}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> {t("error.tryAgain")}
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <Home className="w-4 h-4" /> {t("error.goToDashboard")}
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
