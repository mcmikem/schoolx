import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const cardClassName =
  "rounded-[24px] border border-[var(--border)] bg-white text-[var(--on-surface)] shadow-[var(--sh1)]";
