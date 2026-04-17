"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { useAcademic } from "@/lib/academic-context";
import { useSyncStatus } from "@/lib/useSyncStatus";

function getQuickAction(pathname: string | null) {
  if (!pathname || pathname === "/dashboard") {
      return {
        href: "/dashboard/students",
        label: "Add Learner",
        helper: "Start by entering or checking learner records.",
        cta: "Open learner records",
        icon: "person_add",
      };
  }

  if (pathname.startsWith("/dashboard/students")) {
    return {
      href: "/dashboard/attendance",
      label: "Take Attendance",
      helper: "Mark today before lessons move on.",
      cta: "Open attendance",
      icon: "how_to_reg",
    };
  }

  if (
    pathname.startsWith("/dashboard/attendance") ||
    pathname.startsWith("/dashboard/period-attendance") ||
    pathname.startsWith("/dashboard/dorm-attendance")
  ) {
    return {
      href: "/dashboard/fees",
      label: "Record Fees",
      helper: "Capture payments while families are still at school.",
      cta: "Open fees",
      icon: "payments",
    };
  }

  if (pathname.startsWith("/dashboard/fees")) {
    return {
      href: "/dashboard/messages",
      label: "Send Reminders",
      helper: "Reach parents quickly with short follow-up messages.",
      cta: "Open messages",
      icon: "sms",
    };
  }

  return {
    href: "/dashboard",
    label: "Back to Home",
    helper: "Return to the main dashboard for the next task.",
    cta: "Open dashboard",
    icon: "dashboard",
  };
}

function formatLastSynced(lastSynced: Date | null) {
  if (!lastSynced) return "No recent sync yet";

  const minutesAgo = Math.floor((Date.now() - lastSynced.getTime()) / 60000);

  if (minutesAgo < 1) return "Updated just now";
  if (minutesAgo < 60) return `Updated ${minutesAgo} min ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  return `Updated ${hoursAgo} hr ago`;
}

export default function DashboardStatusStrip() {
  const pathname = usePathname();
  const { currentTerm } = useAcademic();
  const { isOnline, pendingCount, isSyncing, lastSynced, syncNow } =
    useSyncStatus();

  const quickAction = useMemo(() => getQuickAction(pathname), [pathname]);

  const statusTone = !isOnline
    ? {
        icon: "cloud_off",
        chip: "bg-red-50 text-red-700 border-red-200",
        title: "Offline mode",
        message:
          pendingCount > 0
            ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} saved on this device. They will send when internet returns.`
            : "Keep working. Changes will stay on this device until internet returns.",
      }
    : isSyncing
      ? {
          icon: "sync",
          chip: "bg-blue-50 text-blue-700 border-blue-200",
          title: "Syncing now",
          message: "Sending saved work and checking for new school updates.",
        }
      : pendingCount > 0
        ? {
            icon: "cloud_done",
            chip: "bg-amber-50 text-amber-700 border-amber-200",
            title: "Ready to sync",
            message: `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to send. Tap sync when the network is stable.`,
          }
        : {
            icon: "cloud_done",
            chip: "bg-green-50 text-green-700 border-green-200",
            title: "All changes saved",
            message: formatLastSynced(lastSynced),
          };

  return (
    <section className="mx-2 sm:mx-4 mt-3 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.9fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                School work status
              </p>
              <h2 className="mt-2 text-base font-semibold text-slate-900">
                {statusTone.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {statusTone.message}
              </p>
            </div>
            <div
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${statusTone.chip}`}
            >
              <MaterialIcon
                icon={statusTone.icon}
                size={20}
                className={isSyncing ? "animate-spin" : ""}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${statusTone.chip}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${!isOnline ? "bg-red-500" : pendingCount > 0 ? "bg-amber-500" : "bg-green-500"}`}
              />
              {!isOnline
                ? "Internet not available"
                : pendingCount > 0
                  ? `${pendingCount} waiting to send`
                  : "Everything saved"}
            </span>

            {isOnline && pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => syncNow()}
                className="inline-flex items-center gap-2 rounded-full border border-[#17325F]/15 bg-[#17325F] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <MaterialIcon
                  icon="sync"
                  size={16}
                  className={isSyncing ? "animate-spin" : ""}
                />
                Sync now
              </button>
            ) : null}

            <Link
              href="/dashboard/sync-center"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <MaterialIcon icon="history" size={16} />
              Sync center
            </Link>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Current term
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
              <MaterialIcon icon="calendar_month" size={20} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">
                {currentTerm || "Set current term"}
              </p>
              <p className="text-sm leading-6 text-slate-600">
                Keep attendance, fees, and reports in the right school period.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#17325F]">
            Best next step
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#17325F] shadow-sm">
              <MaterialIcon icon={quickAction.icon} size={20} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">
                {quickAction.label}
              </p>
              <p className="text-sm leading-6 text-slate-600">
                {quickAction.helper}
              </p>
            </div>
          </div>

          <Link
            href={quickAction.href}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17325F] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <MaterialIcon icon={quickAction.icon} size={16} />
            {quickAction.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
