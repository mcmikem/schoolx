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
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 px-3 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <MaterialIcon
              icon="school"
              className="text-white"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left in free trial`
                : "Trial expired - Upgrade now!"}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Powered by{" "}
              <a
                href="https://omuto.org/osx.php"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-400"
              >
                Omuto Foundation
              </a>
              : Empowering Schools through OSX
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://essentials.omuto.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <MaterialIcon icon="shopping_bag" style={{ fontSize: 14 }} />
            Shop Omuto Essentials
          </a>
          <a
            href="/dashboard/payment-plans"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
          >
            <MaterialIcon icon="rocket_launch" style={{ fontSize: 14 }} />
            Upgrade Now
          </a>
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <MaterialIcon icon="close" style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
