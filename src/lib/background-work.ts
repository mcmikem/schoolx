/** One slot for nonessential client work. Recheck visibility and foreground input
 * between units; callers retain control of cancellation and their own budgets. */
let tail: Promise<unknown> = Promise.resolve();
let lastInput = 0;
let listening = false;
export function runBackgroundWork<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (typeof window !== "undefined" && !listening) {
    listening = true;
    const active = () => {
      lastInput = Date.now();
    };
    window.addEventListener("pointerdown", active, { passive: true });
    window.addEventListener("keydown", active);
    window.addEventListener("scroll", active, { passive: true, capture: true });
  }
  const result = tail
    .catch(() => {})
    .then(async () => {
      while (
        typeof document !== "undefined" &&
        (document.visibilityState === "hidden" || !navigator.onLine || Date.now() - lastInput < 1200)
      ) {
        if (signal?.aborted) throw new Error("Background work cancelled");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (signal?.aborted) throw new Error("Background work cancelled");
      return work();
    });
  tail = result;
  return result;
}
