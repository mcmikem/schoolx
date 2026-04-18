"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: "top" | "bottom" | "left" | "right";
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard-overview",
    title: "Welcome to Your Dashboard",
    description:
      "This is your main workspace where you can manage all aspects of your school.",
    target: '[data-testid="dashboard-header"]',
    position: "bottom",
    icon: "dashboard",
  },
  {
    id: "attendance-center",
    title: "Attendance Center",
    description:
      "Mark daily attendance, view reports, and send absence alerts to parents.",
    target: '[data-testid="attendance-nav-item"]',
    position: "bottom",
    icon: "event",
  },
  {
    id: "grade-management",
    title: "Grade Management",
    description:
      "Enter assessments, calculate grades, and generate report cards with UNEB support.",
    target: '[data-testid="grades-nav-item"]',
    position: "bottom",
    icon: "grade",
  },
  {
    id: "fee-tracking",
    title: "Fee Management",
    description:
      "Track payments, manage invoices, and set up payment plans for students.",
    target: '[data-testid="fees-nav-item"]',
    position: "bottom",
    icon: "payments",
  },
  {
    id: "parent-communication",
    title: "Parent Communication",
    description:
      "Send SMS alerts, bulk messages, and use the parent portal for engagement.",
    target: '[data-testid="messages-nav-item"]',
    position: "bottom",
    icon: "sms",
  },
];

export default function OnboardingTour() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem(
        `omuto_tour_seen_${user?.id || "demo"}`,
      );
      setHasSeenTour(seen === "true");

      if ((!seen || isDemo) && user?.id && school) {
        setIsActive(true);
        setCurrentStep(0);
      }
    }
  }, [user?.id, school, isDemo]);

  useEffect(() => {
    if (isActive && currentStep >= TOUR_STEPS.length) {
      if (typeof window !== "undefined") {
        localStorage.setItem(`omuto_tour_seen_${user?.id || "demo"}`, "true");
      }
      setIsActive(false);
      toast.success(
        "Tour completed! You can always restart it from the help menu.",
      );
    }
  }, [currentStep, isActive, user?.id, toast]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsActive(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(`omuto_tour_seen_${user?.id || "demo"}`, "true");
    }
  };

  if (!isActive) {
    return null;
  }

  const step = TOUR_STEPS[currentStep];
  const targetElement = document.querySelector(step.target);

  const getPosition = () => {
    if (!targetElement) return { top: 20, left: 20 };

    try {
      const rect = targetElement.getBoundingClientRect();
      switch (step.position) {
        case "top":
          return { top: rect.top - 100, left: rect.left };
        case "bottom":
          return { top: rect.bottom + 20, left: rect.left };
        case "left":
          return { top: rect.top, left: rect.left - 250 };
        case "right":
          return { top: rect.top, left: rect.right + 20 };
        default:
          return { top: rect.top, left: rect.left };
      }
    } catch {
      return { top: 20, left: 20 };
    }
  };

  const position = getPosition();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed z-50 pointer-events-none">
        {targetElement && (
          <div
            className="absolute pointer-events-none z-40 border-2 border-blue-500 bg-blue-50/50 rounded-xl animate-pulse"
            style={{
              top: position.top,
              left: position.left,
              width: targetElement.getBoundingClientRect().width,
              height: targetElement.getBoundingClientRect().height,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}

        <div
          className="absolute z-50 max-w-xs bg-white rounded-xl border border-blue-500 shadow-xl p-6 space-y-4"
          style={{ top: position.top + 20, left: position.left }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <MaterialIcon icon={step.icon} className="text-blue-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-800">{step.title}</h3>
              <p className="text-blue-700">{step.description}</p>
              <div className="flex justify-end gap-2 mt-4">
                {currentStep > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrevious}
                  >
                    Previous
                  </Button>
                )}
                {currentStep < TOUR_STEPS.length - 1 ? (
                  <Button variant="primary" size="sm" onClick={handleNext}>
                    {currentStep === TOUR_STEPS.length - 2 ? "Finish" : "Next"}
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={handleNext}>
                    Got it
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip
                </Button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${index <= currentStep ? "bg-blue-500" : "bg-blue-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
