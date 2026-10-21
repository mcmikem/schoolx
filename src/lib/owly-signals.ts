"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { offlineDB } from "@/lib/offline";
import { readUserScoped, writeUserScoped } from "@/lib/user-scoped-storage";
import { getSuggestions, type OwlySuggestion, type SuggestionSignals } from "@/lib/owly-suggestions";

/**
 * Everything Owly needs to decide whether it is worth interrupting.
 *
 * Signal gathering is kept out of `owly-suggestions.ts` so that the decision
 * itself stays pure and exhaustively testable. This hook only pays for the I/O:
 * the offline queue and the visit counts.
 *
 * All visit state is namespaced per user, so "you have been to this page three
 * times" is that person's own history, never the last person to use the device.
 */

const VISITS_KEY = "owly_visits_v1";
const SEEN_KEY = "owly_seen_v1";

interface VisitState {
  pages: Record<string, number>;
  total: number;
}

const EMPTY_VISITS: VisitState = { pages: {}, total: 0 };

export interface OwlySignals extends SuggestionSignals {
  suggestions: OwlySuggestion[];
}

/**
 * Records that this user opened this page, and reports the resulting signals.
 *
 * The write happens once per path, not once per render, so a re-render or a
 * StrictMode double-invoke cannot inflate a count into a false "stuck" verdict.
 */
export function useOwlySignals(opts: {
  page?: string;
  role?: string;
  online: boolean;
  userId?: string | null;
}): OwlySignals {
  const { page, role, online, userId } = opts;

  // `null` means "not measured yet", which suppresses the blink for one tick so
  // the button does not flash on every page load before the queue is read.
  const [visits, setVisits] = useState<VisitState | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);

  // Re-read on identity change: a different user has their own history.
  //
  // The ref guard matters here too. Reading `SEEN_KEY` and immediately writing
  // it means a StrictMode double-invoke (or any remount in the same session)
  // reads the flag this mount just wrote, decides the user is no longer new,
  // and silently withholds the one-time welcome.
  const initialisedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) {
      initialisedFor.current = null;
      setVisits(EMPTY_VISITS);
      return;
    }
    if (initialisedFor.current === userId) return;
    initialisedFor.current = userId;
    const seen = readUserScoped<boolean>(SEEN_KEY, userId);
    setIsNewUser(seen !== true);
    writeUserScoped(SEEN_KEY, userId, true);
    setVisits(readUserScoped<VisitState>(VISITS_KEY, userId) ?? EMPTY_VISITS);
  }, [userId]);

  // Count this page visit once per path per user. The ref guard matters: React
  // StrictMode double-invokes effects in development, and a double count turns
  // a first visit into an apparent second one, eroding the stuck threshold
  // before the user has done anything wrong.
  const countedVisit = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !page) return;
    const key = `${userId}::${page}`;
    if (countedVisit.current === key) return;
    countedVisit.current = key;
    setVisits((prev) => {
      const base = prev ?? EMPTY_VISITS;
      const next: VisitState = {
        pages: { ...base.pages, [page]: (base.pages[page] ?? 0) + 1 },
        total: base.total + 1,
      };
      writeUserScoped(VISITS_KEY, userId, next);
      return next;
    });
  }, [page, userId]);

  // Depth of the offline write queue. Read on mount and whenever connectivity
  // flips, which is exactly when the count becomes meaningful.
  useEffect(() => {
    let cancelled = false;
    offlineDB
      .getPendingSync()
      .then((rows) => {
        if (!cancelled) setPendingSyncCount(rows.length);
      })
      .catch(() => {
        // IndexedDB unavailable (private mode). Treat as an empty queue rather
        // than claiming work is safely synced.
        if (!cancelled) setPendingSyncCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [online, userId]);

  const signals: SuggestionSignals = useMemo(
    () => ({
      page,
      role,
      online,
      pendingSyncCount,
      visitsThisPage: visits?.pages[page ?? ""] ?? 0,
      totalVisits: visits?.total ?? 0,
      isNewUser,
    }),
    [page, role, online, pendingSyncCount, visits, isNewUser],
  );

  const suggestions = useMemo(() => getSuggestions(signals), [signals]);

  return { ...signals, suggestions };
}
