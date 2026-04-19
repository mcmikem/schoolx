"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface UseSessionTimeoutOptions {
  timeoutMs?: number;
  warningMs?: number;
  onTimeout?: () => void;
  enabled?: boolean;
}

export function useSessionTimeout({
  timeoutMs = 30 * 60 * 1000,
  warningMs = 5 * 60 * 1000,
  onTimeout,
  enabled = true,
}: UseSessionTimeoutOptions = {}) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeoutMs);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingTime(warningMs);
    }, timeoutMs - warningMs);
    timeoutRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      if (onTimeoutRef.current) {
        onTimeoutRef.current();
      } else {
        router.push("/login?timeout=true");
      }
    }, timeoutMs);
  }, [clearAllTimers, warningMs, timeoutMs, router]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingTime(timeoutMs);
    startTimers();
  }, [timeoutMs, startTimers]);

  useEffect(() => {
    if (!enabled) return;

    const activityEvents = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;

    // Throttle activity resets to once per 30s to avoid excessive timer restarts
    let throttleTimer: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 30_000);
      resetTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    startTimers();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
      clearAllTimers();
    };
  }, [enabled, startTimers, resetTimer, clearAllTimers]);

  useEffect(() => {
    if (!showWarning || !enabled) return;

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning, enabled]);

  return {
    showWarning,
    remainingTime,
    resetTimer,
    extendSession: resetTimer,
  };
}
