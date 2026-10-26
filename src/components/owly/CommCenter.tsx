"use client";

import { useEffect, useRef } from "react";
import {
  type OwlyComm,
  backOnlineComm,
  failedSyncComm,
  offlineComm,
  slowInternetComm,
  syncedComm,
} from "@/lib/owly-comm";
import { useToast } from "@/components/Toast";
import { useSyncStatus } from "@/lib/useSyncStatus";
import { askOwly } from "@/lib/owly-bus";
import { logger } from "@/lib/logger";

/**
 * Routes app-wide status changes through Owly.
 *
 * Offline/online flips, slow-signal warnings and sync outcomes used to be
 * proposals for yet more toasts. They now go through the assistant: a badge on
 * the owl when it is closed, a chat message when it is open. The toast is the
 * fallback only when no assistant is mounted, so public pages stay informed.
 */
export default function CommCenter() {
  const { isOnline, pendingCount } = useSyncStatus();
  const toast = useToast();
  const prevOnline = useRef<boolean | null>(null);
  const prevPending = useRef<number | null>(null);
  const lastSlowAt = useRef(0);

  function speak(comm: OwlyComm) {
    const delivered = askOwly({
      kind: "notify",
      title: comm.title,
      detail: comm.detail,
      severity: comm.severity,
    });
    if (!delivered) {
      // No assistant mounted (e.g. marketing pages): toasts keep working.
      const { title, detail, severity } = comm;
      const fallback = detail ? `${title}. ${detail}` : title;
      if (severity === "error")
        toast.error(fallback, {
          label: "Sync Center",
          onClick: () => window.location.assign("/dashboard/sync-center/"),
        });
      else if (severity === "warning") toast.warning(fallback);
      else if (severity === "success") toast.success(fallback);
      else toast.info(fallback);
    }
  }

  // Online / offline transitions. The ref guard means the first paint — where
  // the browser's connectivity state is simply reported, not a change — is
  // silent, exactly like an app opening while offline should not scold the
  // user on arrival.
  useEffect(() => {
    if (prevOnline.current === null) {
      prevOnline.current = isOnline;
      return;
    }
    if (prevOnline.current === isOnline) return;
    prevOnline.current = isOnline;
    try {
      speak(isOnline ? backOnlineComm(pendingCount) : offlineComm());
    } catch (error) {
      logger.warn("CommCenter failed to announce connectivity", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // The queue draining is the payoff moment a teacher is waiting on.
  useEffect(() => {
    if (prevPending.current === null) {
      prevPending.current = pendingCount;
      return;
    }
    const previous = prevPending.current;
    prevPending.current = pendingCount;
    if (previous > 0 && pendingCount === 0 && isOnline) {
      try {
        speak(syncedComm(previous));
      } catch (error) {
        logger.warn("CommCenter failed to announce sync", error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount]);

  // Slow-signal notices, throttled to once per 15 minutes at most.
  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    };
    const connection = nav.connection;
    const check = () => {
      if (cancelled || !isOnline) return;
      const comm = slowInternetComm(connection);
      if (!comm) return;
      const now = Date.now();
      if (now - lastSlowAt.current < 15 * 60 * 1000) return;
      lastSlowAt.current = now;
      try {
        speak(comm);
      } catch (error) {
        logger.warn("CommCenter failed to announce slow connection", error);
      }
    };
    check();
    connection?.addEventListener?.("change", check);
    return () => {
      cancelled = true;
      connection?.removeEventListener?.("change", check);
    };
  }, [isOnline]);

  return null;
}
