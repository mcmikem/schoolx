"use client";
import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t("error.pageNotFound")}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {t("error.pageNotFoundDescription")}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.history.back();
              }
            }}
            role="button"
            tabIndex={0}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t("error.goBack")}
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Home className="w-4 h-4" /> {t("error.dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
