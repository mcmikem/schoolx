"use client";

import { useEffect } from "react";

export default function DebugPing() {
  useEffect(() => {
    // #region agent log
    fetch("/api/debug/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "9e14f3",
        runId: "pre-fix",
        hypothesisId: "PIPE",
        location: "src/components/DebugPing.tsx:useEffect",
        message: "client bundle active",
        data: {
          path: typeof window !== "undefined" ? window.location.pathname : null,
          ts: Date.now(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return null;
}

