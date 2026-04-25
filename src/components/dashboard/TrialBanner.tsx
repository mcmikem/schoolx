"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

export default function TrialBanner() {
  const { school, isDemo } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    if (school?.trial_ends_at) {
      const end = new Date(school.trial_ends_at).getTime();
      const now = Date.now();
      const days = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      setDaysLeft(days);
    }

    const stored = localStorage.getItem("trial-banner-dismissed");
    if (stored) {
      const dismissedAt = parseInt(stored);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, [school?.trial_ends_at]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("trial-banner-dismissed", Date.now().toString());
  };

  if (dismissed || isDemo || school?.subscription_status !== "trial")
    return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <MaterialIcon
              icon="campaign"
              className="text-amber-600"
              style={{ fontSize: 18 }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-amber-800">
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left in your free trial`
                : "Trial expired"}
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              Powered by{" "}
              <a
                href="https://omuto.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-800"
              >
                Omuto Foundation
              </a>{" "}
              —
              <a
                href="/dashboard/payment-plans"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-800 ml-1"
              >
                Upgrade to SkoolMate OS Premium
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://essentials.omuto.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-lg bg-amber-100/50 hover:bg-amber-100 transition-colors"
          >
            <MaterialIcon icon="star" style={{ fontSize: 14 }} />
            SkoolMate Essentials
          </a>
          <a
            href="/dashboard/payment-plans"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 transition-colors"
          >
            <MaterialIcon icon="rocket_launch" style={{ fontSize: 14 }} />
            Upgrade Now
          </a>
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-400 hover:text-amber-600 transition-colors"
          >
            <MaterialIcon icon="close" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
