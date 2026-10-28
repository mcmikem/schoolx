"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { safeLocalStorage } from "@/lib/safe-storage";

const WARMED_KEY = "skoolmate_offline_data_v1";
const START_DELAY_MS = 12_000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Tables the offline hooks and common list screens read. The per-table cap is
 * deliberately small: this is a working copy for the next day or two, not a
 * mirror of every mark ever entered. Larger tables are paged by the screens
 * themselves when the user opens them online.
 */
const OFFLINE_DATA_TABLES = [
  "students",
  "classes",
  "subjects",
  "academic_terms",
  "fee_structure",
  "fee_adjustments",
  "messages",
  "events",
  "timetable",
  "homework",
  "homework_submissions",
  "staff",
  "users",
  "canteen_items",
  "canteen_sales",
  "inventory",
  "report_cards",
  "behavior_logs",
  "dorms",
  "dorm_students",
  "dorm_attendance",
  "transport_routes",
  "transport_students",
  "teacher_substitutions",
  "student_promotions",
  "student_transfers",
  "promotion_history",
  "leave_requests",
  "attendance",
  "period_attendance",
  "grades",
  "fee_payments",
];

// A small working set keeps attendance, grades and fee recording usable on
// phones where Data Saver is enabled, without downloading the full cache.
const ESSENTIAL_OFFLINE_DATA_TABLES = [
  "students",
  "classes",
  "subjects",
  "academic_terms",
  "attendance",
  "grades",
  "fee_structure",
  "fee_payments",
];

interface WarmedRecord {
  userId: string;
  at: number;
  profile: "essential" | "full";
}

function connectionProfile(): "essential" | "full" {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  const type = connection?.effectiveType?.toLowerCase();
  return connection?.saveData || type === "slow-2g" || type === "2g" || type === "3g" ? "essential" : "full";
}

function alreadyWarmed(userId: string, profile: WarmedRecord["profile"]): boolean {
  try {
    const raw = safeLocalStorage.getItem(WARMED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as WarmedRecord;
    const recent = parsed.userId === userId && Date.now() - parsed.at < REFRESH_AFTER_MS;
    return recent && (profile === "essential" || parsed.profile === "full");
  } catch {
    return false;
  }
}

function markWarmed(userId: string, profile: WarmedRecord["profile"]) {
  try {
    safeLocalStorage.setItem(WARMED_KEY, JSON.stringify({ userId, at: Date.now(), profile } satisfies WarmedRecord));
  } catch {
    // Storage unavailable: retrying next load is harmless.
  }
}

/**
 * Fill the offline store for the screens that read it through `useOffline*`.
 *
 * This is separate from the route warmer: a page's document can be cached while
 * the rows behind it are not. Waiting for idle time keeps the download out of
 * the way of the screen the user just opened, and the daily marker stops every
 * launch from spending the same data again.
 */
export function OfflineDataWarmer() {
  const { user, isDemo, authInitialized } = useAuth();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!authInitialized || !user || isDemo || !isOnline) return;
    if (typeof navigator === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    const profile = connectionProfile();
    if (alreadyWarmed(user.id, profile)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleHandle: number | undefined;

    const run = async () => {
      if (cancelled || !navigator.onLine) return;
      try {
        const tables = profile === "essential" ? ESSENTIAL_OFFLINE_DATA_TABLES : OFFLINE_DATA_TABLES;
        const result = await offlineDB.warmTables(
          tables,
          profile === "essential" ? { pageSize: 100, maxRows: 100 } : { pageSize: 250, maxRows: 1000 },
        );
        if (cancelled) return;
        // A single unavailable table must not make every launch download the
        // other 31 again. Failed tables are retried on the next daily pass.
        if (result.rows > 0) markWarmed(user.id, profile);
        if (result.errors.length > 0) logger.debug("[offline] some tables were not warmed", result.errors);
        window.dispatchEvent(
          new CustomEvent("skoolmate:offline-data-warmed", {
            detail: result,
          }),
        );
      } catch (error) {
        logger.warn("[offline] data warm-up failed", error);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => void run(), { timeout: 30_000 });
    } else {
      timer = setTimeout(() => void run(), START_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
      if (timer) clearTimeout(timer);
    };
  }, [authInitialized, user, isDemo, isOnline]);

  return null;
}
