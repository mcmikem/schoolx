"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type EventType = "page_view" | "feature_use" | "error" | "api_call";

interface TrackEvent {
  event_type: EventType;
  event_name: string;
  metadata?: Record<string, unknown>;
  school_id?: string | null;
  url?: string;
}

let pendingBatch: TrackEvent[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function sendBatch() {
  const batch = pendingBatch.splice(0, pendingBatch.length);
  if (batch.length === 0) return;
  fetch("/api/track/event/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: batch }),
    keepalive: true,
  }).catch(() => {});
}

function queueEvent(event: TrackEvent) {
  pendingBatch.push(event);
  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      batchTimer = null;
      sendBatch();
    }, 5000);
  }
}

function flushNow() {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  sendBatch();
}

export function useAppTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const lastPath = useRef<string>("");

  useEffect(() => {
    const fullPath = pathname + (searchParams?.toString() ? "?" + searchParams.toString() : "");
    if (fullPath === lastPath.current) return;
    lastPath.current = fullPath;

    queueEvent({
      event_type: "page_view",
      event_name: pathname || "/",
      metadata: {
        search: searchParams?.toString() || null,
        referrer: document.referrer || null,
      },
      school_id: user?.school_id,
      url: fullPath,
    });
  }, [pathname, searchParams, user?.school_id]);

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      queueEvent({
        event_type: "error",
        event_name: event.message?.slice(0, 200) || "Unknown client error",
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack?.slice(0, 500),
        },
        school_id: user?.school_id,
        url: window.location.href,
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const msg = event.reason?.message || event.reason?.toString() || "Unhandled rejection";
      queueEvent({
        event_type: "error",
        event_name: msg.slice(0, 200),
        metadata: {
          stack: event.reason?.stack?.slice(0, 500),
        },
        school_id: user?.school_id,
        url: window.location.href,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [user?.school_id]);

  useEffect(() => {
    window.addEventListener("beforeunload", flushNow);
    return () => window.removeEventListener("beforeunload", flushNow);
  }, []);
}

export function trackEvent(
  event_type: EventType,
  event_name: string,
  metadata?: Record<string, unknown>,
  school_id?: string | null,
) {
  queueEvent({
    event_type,
    event_name,
    metadata,
    school_id,
    url: window.location.href,
  });
}
