"use client";

import { useEffect, useState } from "react";
import { Joyride, type Step, type EventData, EVENTS, STATUS } from "react-joyride";
import { useAuth } from "@/lib/auth-context";
import { readUserScoped, writeUserScoped } from "@/lib/user-scoped-storage";
import { usePathname } from "next/navigation";

const DISMISSED_KEY = "skoolmate_guided_tour_dismissed";

const TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Welcome to SkoolMate! Let me show you around. This quick tour takes 30 seconds.",
    placement: "center",
  },
  {
    target: '[data-tour="sidebar"]',
    content:
      "This is your navigation menu. Everything you need is here — students, attendance, fees, grades, and more.",
    placement: "right",
  },
  {
    target: '[data-tour="search"]',
    content: "Press ⌘K anytime to search students, pages, or actions instantly.",
    placement: "bottom",
  },
  {
    target: '[data-tour="add-payment"]',
    content: "Record a fee payment in seconds. Tap here to get started.",
    placement: "bottom",
  },
  {
    target: '[data-tour="offline"]',
    content: "SkoolMate works offline. Your changes are saved on this device and sync when you're back online.",
    placement: "bottom",
  },
  {
    target: "body",
    content: "That's it! You're ready to go. You can replay this tour anytime from Settings.",
    placement: "center",
  },
];

export default function GuidedTour() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [run, setRun] = useState(false);
  const [steps] = useState<Step[]>(TOUR_STEPS);

  useEffect(() => {
    if (!user) return;
    if (pathname?.replace(/\/$/, "") !== "/dashboard") return;
    const dismissed = readUserScoped<boolean>(DISMISSED_KEY, user.id) === true;
    if (dismissed) return;
    // Delay so the dashboard renders first
    const t = setTimeout(() => setRun(true), 1500);
    return () => clearTimeout(t);
  }, [user, pathname]);

  const handleCallback = (data: EventData) => {
    const { status, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (user) writeUserScoped(DISMISSED_KEY, user.id, true);
    }
    if (type === EVENTS.TOUR_END) {
      setRun(false);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleCallback}
      options={{
        primaryColor: "var(--primary, #005ce6)",
        zIndex: 10000,
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          fontSize: 14,
        },
        buttonPrimary: {
          borderRadius: 8,
          padding: "8px 16px",
        },
        buttonBack: {
          borderRadius: 8,
          padding: "8px 16px",
        },
      }}
    />
  );
}
