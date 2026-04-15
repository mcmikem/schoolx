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

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingTime(timeoutMs);
  }, [timeoutMs]);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const handleTimeout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    if (onTimeout) {
      onTimeout();
    } else {
      router.push("/login?timeout=true");
    }
  }, [clearAllTimers, onTimeout, router]);

  useEffect(() => {
    if (!enabled) return;

    const activityEvents = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];

    const handleActivity = () => {
      resetTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingTime(warningMs);
    }, timeoutMs - warningMs);

    timeoutRef.current = setTimeout(handleTimeout, timeoutMs);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [
    enabled,
    timeoutMs,
    warningMs,
    resetTimer,
    clearAllTimers,
    handleTimeout,
  ]);

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
