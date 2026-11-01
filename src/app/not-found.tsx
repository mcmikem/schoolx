"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { t } from "@/i18n";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--surface-container-low)]">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-[var(--t4)] mb-4">404</h1>
        <h2 className="text-xl font-bold text-[var(--t1)] mb-2">{t("error.pageNotFound")}</h2>
        <p className="text-[var(--t3)] text-sm mb-6">{t("error.pageNotFoundDescription")}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-[var(--surface-container)] text-[var(--t2)] rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <MaterialIcon icon="arrow_back" size={16} className="h-4" /> {t("error.goBack")}
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <MaterialIcon icon="home" size={16} className="h-4" /> {t("error.dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
