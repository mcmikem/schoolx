"use client";

import { useState, useEffect, useCallback } from "react";
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
    description: "This is your main workspace where you can manage all aspects of your school.",
    target: '[data-testid="dashboard-header"]',
    position: "bottom",
    icon: "dashboard",
  },
  {
    id: "attendance-center",
    title: "Attendance Center",
    description: "Mark daily attendance, view reports, and send absence alerts to parents.",
    target: '[data-testid="attendance-nav-item"]',
    position: "bottom",
    icon: "event",
  },
  {
    id: "grade-management",
    title: "Grade Management",
    description: "Enter assessments, calculate grades, and generate report cards with UNEB support.",
    target: '[data-testid="grades-nav-item"]',
    position: "bottom",
    icon: "grade",
  },
  {
    id: "fee-tracking",
    title: "Fee Management",
    description: "Track payments, manage invoices, and set up payment plans for students.",
    target: '[data-testid="fees-nav-item"]',
    position: "bottom",
    icon: "payments",
  },
  {
    id: "parent-communication",
    title: "Parent Communication",
    description: "Send SMS alerts, bulk messages, and use the parent portal for engagement.",
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
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const step = TOUR_STEPS[currentStep];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem(`omuto_tour_seen_${user?.id || "demo"}`);
      setHasSeenTour(seen === "true");

      if ((!seen || isDemo) && user?.id && school) {
        setIsActive(true);
        setCurrentStep(0);
      }
    }
  }, [user?.id, school, isDemo]);

  useEffect(() => {
    if (step?.target) {
      const el = document.querySelector(step.target);
      setTargetElement(el);
    } else {
      setTargetElement(null);
    }
  }, [step?.target]);

  useEffect(() => {
    if (isActive && currentStep >= TOUR_STEPS.length) {
      if (typeof window !== "undefined") {
        localStorage.setItem(`omuto_tour_seen_${user?.id || "demo"}`, "true");
      }
      setIsActive(false);
      toast.success("Tour completed! Tap the Owly assistant (bottom-right) any time you need help.");
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

  const getPosition = useCallback(() => {
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
  }, [targetElement, step.position]);

  const position = getPosition();

  if (!isActive) {
    return null;
  }

  const targetRect = targetElement?.getBoundingClientRect();

  return (
    <>
      {/* Non-blocking overlay — click-through so dashboard stays interactive */}
      <div className="fixed inset-0 bg-black/20 z-50 pointer-events-none" />
      {/* Target element highlight */}
      {targetRect && (
        <div
          className="fixed z-50 border-2 border-blue-500 bg-blue-100/30 rounded-xl pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
      {/* Tour card */}
      <div
        className="fixed z-50 max-w-xs bg-white rounded-xl border border-blue-500 shadow-xl p-6 space-y-4"
        style={{ top: position.top, left: position.left, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleSkip}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
          aria-label="Close tour"
        >
          <MaterialIcon icon="close" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <MaterialIcon icon={step.icon} className="text-blue-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-800">{step.title}</h3>
            <p className="text-blue-700 text-[13px] mt-1">{step.description}</p>
            <div className="flex items-center justify-between gap-2 mt-4">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${index <= currentStep ? "bg-blue-500" : "bg-blue-200"}`}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                {currentStep > 0 && (
                  <Button variant="secondary" size="sm" onClick={handlePrevious}>
                    Back
                  </Button>
                )}
                {currentStep < TOUR_STEPS.length - 1 ? (
                  <Button variant="primary" size="sm" onClick={handleNext}>
                    {currentStep === TOUR_STEPS.length - 2 ? "Finish" : "Next"}
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={handleSkip}>
                    Got it
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
