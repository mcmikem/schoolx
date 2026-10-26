"use client";

/**
 * Builders for the app's status communications, phrased once and sent through
 * the one channel that can explain them further: the Owly assistant.
 *
 * Keeping the pure builders here means the mounted CommCenter only deals with
 * wiring (connection events, sync state), and the wording is exhaustively
 * testable. When no assistant is mounted the caller falls back to a toast, so
 * critical offline messages are never lost.
 */

export type CommSeverity = "info" | "success" | "warning" | "error";

export interface OwlyComm {
  title: string;
  detail?: string;
  severity: CommSeverity;
}

export interface SlowConnectionLike {
  effectiveType?: string | null;
  saveData?: boolean;
}

/** True when the device looks constricted enough to warn about. */
export function isSlowConnection(conn?: SlowConnectionLike | null): boolean {
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
}

export function slowInternetComm(conn?: SlowConnectionLike | null): OwlyComm | null {
  if (!isSlowConnection(conn)) return null;
  return {
    severity: "warning",
    title: "Slow connection detected",
    detail:
      "SkoolMate keeps your work on this phone and syncs when the signal improves. Avoid closing the app in the middle of entering marks or fees.",
  };
}

export function offlineComm(): OwlyComm {
  return {
    severity: "warning",
    title: "You are offline",
    detail: "Your changes save on this phone and sync once signal returns — nothing is lost.",
  };
}

export function backOnlineComm(pendingCount: number): OwlyComm {
  return pendingCount > 0
    ? {
        severity: "info",
        title: "Back online",
        detail: `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"} saved on this phone…`,
      }
    : { severity: "success", title: "Back online" };
}

export function refreshFailedComm(): OwlyComm {
  return {
    severity: "warning",
    title: "Some dashboard data couldn't refresh",
    detail:
      "Showing the most recent available data. This usually means slow internet or a slow school server — it will retry automatically.",
  };
}

export function syncedComm(count: number): OwlyComm {
  return {
    severity: "success",
    title: `${count} change${count === 1 ? "" : "s"} synced`,
    detail: "Everything saved on this phone is now on the server.",
  };
}

export function failedSyncComm(failed: number): OwlyComm {
  return {
    severity: "error",
    title: `${failed} change${failed === 1 ? "" : "s"} could not sync`,
    detail: "Open Sync Center to see why. Your work stays saved on this phone.",
  };
}

/** The chat message a comm becomes inside the assistant. */
export function commToMessage(comm: OwlyComm): string {
  return comm.detail ? `${comm.title}\n\n${comm.detail}` : comm.title;
}
