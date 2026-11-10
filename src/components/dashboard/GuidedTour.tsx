"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EVENTS, type EventData, Joyride, STATUS, type Step } from "react-joyride";
import { useAuth } from "@/lib/auth-context";
import { getGuidedTourTask } from "@/lib/guided-tour-content";
import { writeUserScoped } from "@/lib/user-scoped-storage";

const DISMISSED_KEY = "skoolmate_guided_tour_dismissed";

function tourSteps(isMobile: boolean, roleTask: string): Step[] {
  return [
    {
      target: "body",
      content: "Welcome to SkoolMate. This short tour shows you where to find your daily school tasks.",
      placement: "center",
    },
    {
      target: isMobile ? '[data-tour="mobile-nav"]' : '[data-tour="sidebar"]',
      content: isMobile
        ? "Use the bottom bar for Home, Attendance, Fees, and More. Tap More to open the full menu."
        : "Use this menu to open Students, Attendance, Fees, Grades, and the other school tools.",
      placement: isMobile ? "top" : "right",
    },
    {
      target: isMobile ? '[data-tour="search-mobile"]' : '[data-tour="search"]',
      content: isMobile
        ? "Tap Search at the top whenever you need to find a student or page."
        : "Search for students, pages, and actions here. The keyboard shortcut is shown beside the search box.",
      placement: "bottom",
    },
    {
      target: '[data-tour="dashboard-main"]',
      content: roleTask,
      placement: "center",
    },
    {
      target: "body",
      content: "That’s the tour. You can replay it from Settings whenever you need a refresher.",
      placement: "center",
    },
  ];
}

export default function GuidedTour() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [run, setRun] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const roles = user ? [user.role, ...(user.roles ?? [])] : [];
  const roleTask = getGuidedTourTask(roles);

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 1023px)").matches);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (pathname?.replace(/\/$/, "") !== "/dashboard") return;
    if (window.location.hash !== "#guided-tour") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setRun(true);
  }, [user, pathname]);

  const handleCallback = (data: EventData) => {
    const { status, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (user) writeUserScoped(DISMISSED_KEY, user.id, true);
    }
    if (type === EVENTS.TOUR_END) {
      setRun(false);
      // Closing the tour ends with status=running in Joyride. Persist dismissal.
      if (user) writeUserScoped(DISMISSED_KEY, user.id, true);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={tourSteps(isMobile, roleTask)}
      run={run}
      continuous
      onEvent={handleCallback}
      options={{
        primaryColor: "var(--primary, #005ce6)",
        zIndex: 10000,
        width: "min(92vw, 560px)",
      }}
      styles={{
        tooltip: {
          borderRadius: 18,
          maxWidth: "min(92vw, 560px)",
        },
        tooltipContainer: {
          padding: 24,
        },
        tooltipContent: {
          fontSize: 18,
          lineHeight: 1.6,
        },
        tooltipTitle: {
          fontSize: 21,
          lineHeight: 1.3,
        },
        buttonPrimary: {
          borderRadius: 10,
          padding: "12px 20px",
          fontSize: 16,
        },
        buttonBack: {
          borderRadius: 10,
          padding: "12px 20px",
          fontSize: 16,
        },
      }}
    />
  );
}
