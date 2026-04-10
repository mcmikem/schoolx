import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const cardClassName =
  "rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm";
