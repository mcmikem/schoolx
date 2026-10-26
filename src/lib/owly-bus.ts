"use client";

/**
 * The one way the rest of the app talks to Owly.
 *
 * Owly used to be an island: its open state lived inside the assistant
 * component, so a page could show a "How to…" card but could not ask the guide
 * to explain it. Everything now routes through this tiny bus, which keeps the
 * assistant as the single place guidance is rendered.
 *
 * Requests are intentionally fire-and-forget. `askOwly` returns false when no
 * assistant is mounted (public pages), so callers can fall back to human
 * support instead of pretending something happened.
 */

export type OwlyRequest =
  | { kind: "guide"; guideId: string }
  | { kind: "error"; message: string; page?: string }
  | { kind: "ask"; question: string }
  | { kind: "tour" }
  /** App statuses routed through Owly (offline / back online / slow signal /
   *  sync outcomes). When the assistant is closed these surface as a badge on
   *  the owl and are delivered as chat messages on open; they keep pages clean
   *  instead of stacking toasts over content. */
  | {
      kind: "notify";
      title: string;
      detail?: string;
      severity: "info" | "success" | "warning" | "error";
    };

type Listener = (request: OwlyRequest) => void;

const listeners = new Set<Listener>();

/** Send a request to the mounted assistant. False means nobody is listening. */
export function askOwly(request: OwlyRequest): boolean {
  if (listeners.size === 0) return false;
  listeners.forEach((listener) => {
    try {
      listener(request);
    } catch {
      // One broken listener must not stop the others.
    }
  });
  return true;
}

/** Subscribe the assistant. Returns an unsubscribe function. */
export function subscribeOwly(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when an assistant is mounted and can receive requests. */
export function isOwlyAvailable(): boolean {
  return listeners.size > 0;
}
