"use client";
import { Suspense } from "react";
import { useAppTracking } from "@/lib/hooks/useAppTracking";

function TrackerInner() {
  useAppTracking();
  return null;
}

export function AppTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  );
}
