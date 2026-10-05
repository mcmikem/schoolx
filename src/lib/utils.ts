import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const cardClassName =
  "rounded-[24px] border border-[var(--border)] bg-white text-[var(--on-surface)] shadow-[var(--sh1)]";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Time-of-day greeting used across every dashboard header.
 *
 * Previously each dashboard computed this inline, and they had already drifted
 * apart: six used "Good Morning" while MarketerDashboard used "Good morning".
 * One helper keeps the wording, and the hour boundaries, in one place.
 *
 * @param now Injectable for tests; defaults to the current time.
 */
export function greetingFor(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
 * Date line shown under the greeting, e.g. "Monday, 5 Oct 2026".
 *
 * The dashboards disagreed on whether to include the year, so the year is
 * always included here — a school term routinely spans a calendar year.
 */
export function todayLabelFor(now: Date = new Date()): string {
  return now.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
