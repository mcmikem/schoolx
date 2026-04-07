"use client";

import { useEffect } from "react";

export default function MobileInit() {
  useEffect(() => {
    // Only run in Capacitor (native app) environment
    if (typeof (window as any).Capacitor !== "undefined") {
      import("@/lib/capacitor-init").then(({ initCapacitor }) => {
        initCapacitor();
      });
    }
  }, []);

  return null;
}