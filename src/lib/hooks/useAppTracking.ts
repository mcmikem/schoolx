"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EventType = "page_view" | "feature_use" | "error" | "api_call";

interface TrackEvent {
  event_type: EventType;
  event_name: string;
  metadata?: Record<string, unknown>;
  url?: string;
}

let pendingBatch: TrackEvent[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function sendBatch() {
  const batch = pendingBatch.splice(0, pendingBatch.length);
  if (batch.length === 0) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
    await fetch("/api/track/event/", {
      method: "POST",
      headers,
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Telemetry must never interfere with the user's active task.
  }
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
  const lastPath = useRef<string>("");

  useEffect(() => {
    const fullPath = pathname || "/";
    if (fullPath === lastPath.current) return;
    lastPath.current = fullPath;

    queueEvent({
      event_type: "page_view",
      event_name: fullPath,
      url: fullPath,
    });
  }, [pathname]);

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      queueEvent({
        event_type: "error",
        event_name: "window_error",
        metadata: {
          lineno: event.lineno,
          colno: event.colno,
        },
        url: window.location.pathname,
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const msg = event.reason?.message || event.reason?.toString() || "Unhandled rejection";
      queueEvent({
        event_type: "error",
        event_name: "unhandled_rejection",
        url: window.location.pathname,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", flushNow);
    return () => window.removeEventListener("beforeunload", flushNow);
  }, []);
}

export function trackEvent(
  event_type: EventType,
  event_name: string,
  metadata?: Record<string, unknown>,
  _school_id?: string | null,
) {
  queueEvent({
    event_type,
    event_name,
    metadata,
    url: window.location.pathname,
  });
}
