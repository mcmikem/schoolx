"use client";

import { useEffect, useState } from "react";

export type PerformanceMode = "auto" | "lite" | "full";
export const PERFORMANCE_KEY = "skoolmate-performance";
export const PERFORMANCE_EVENT = "skoolmate:performance-change";

let sessionMode: PerformanceMode | null = null;
type DeviceHints = {
  reducedData?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};
export function shouldUseLite(hints: DeviceHints, mode: PerformanceMode = "auto"): boolean {
  if (mode !== "auto") return mode === "lite";
  return Boolean(
    (hints.deviceMemory && hints.deviceMemory <= 3) ||
      (hints.hardwareConcurrency && hints.hardwareConcurrency <= 4) ||
      hints.connection?.saveData ||
      hints.reducedData ||
      ["slow-2g", "2g", "3g"].includes(hints.connection?.effectiveType || ""),
  );
}
export function readPerformanceMode(): PerformanceMode {
  if (sessionMode) return sessionMode;
  try {
    const value = localStorage.getItem(PERFORMANCE_KEY);
    return value === "lite" || value === "full" ? value : "auto";
  } catch {
    return "auto";
  }
}
export function isLiteMode(): boolean {
  if (typeof navigator === "undefined") return false;
  return shouldUseLite({ ...deviceHints() }, readPerformanceMode());
}
function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & DeviceHints;
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    connection: nav.connection,
    reducedData: typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-data: reduce)").matches,
  };
}
export function applyPerformanceMode(mode: PerformanceMode): void {
  sessionMode = mode;
  try {
    localStorage.setItem(PERFORMANCE_KEY, mode);
  } catch {
    /* Still apply for this session. */
  }
  document.documentElement.classList.toggle("lite", shouldUseLite(deviceHints(), mode));
  window.dispatchEvent(new Event(PERFORMANCE_EVENT));
}
export function usePerformanceMode() {
  const [mode, setMode] = useState<PerformanceMode>("auto");
  useEffect(() => {
    const update = () => {
      const next = readPerformanceMode();
      setMode(next);
      document.documentElement.classList.toggle("lite", isLiteMode());
    };
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    update();
    window.addEventListener(PERFORMANCE_EVENT, update);
    const stored = () => {
      sessionMode = null;
      update();
    };
    window.addEventListener("storage", stored);
    connection?.addEventListener("change", update);
    return () => {
      window.removeEventListener(PERFORMANCE_EVENT, update);
      window.removeEventListener("storage", stored);
      connection?.removeEventListener("change", update);
    };
  }, []);
  return { mode, setMode: applyPerformanceMode };
}
