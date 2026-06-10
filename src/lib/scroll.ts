import { logger } from "@/lib/logger";

export function smoothScroll(id: string) {
  if (typeof document === "undefined") return;
  try {
    const el = document.querySelector(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const target = id.replace("#", "");
      const targetEl = document.getElementById(target);
      if (targetEl)
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (e) {
    logger.error("Scroll error:", e);
  }
}

export function scrollModalToTop(modalEl: HTMLElement | null) {
  if (!modalEl) return;
  try {
    modalEl.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch { /* ignore */ }
}

export function focusFirstInput(container: HTMLElement | null) {
  if (!container) return;
  try {
    const input = container.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    input?.focus();
  } catch { /* ignore */ }
}
