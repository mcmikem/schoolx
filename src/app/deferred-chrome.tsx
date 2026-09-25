"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";

// Below-the-fold / after-interactive chrome, split out of the initial bundle.
// - Analytics: third-party page-view tracking (renders null without GA id)
// - AppTracker: engagement telemetry hook
// - MobileInit: Capacitor native-shell init (no-op on web)
const Analytics = dynamic(() => import("@/components/Analytics").then((m) => m.Analytics), { ssr: false });
const AppTracker = dynamic(() => import("@/components/AppTracker").then((m) => m.AppTracker), { ssr: false });
const MobileInit = dynamic(() => import("./mobile-init"), { ssr: false });

export default function DeferredChrome() {
  return (
    <>
      <Suspense fallback={null}>
        <AppTracker />
      </Suspense>
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
      <MobileInit />
    </>
  );
}
