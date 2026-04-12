"use client";

import { useState, useCallback, ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  isCompleted?: boolean;
  isActive?: boolean;
}

interface ProgressiveDisclosureProps {
  steps: Step[];
  children: ReactNode;
  onComplete?: (completedSteps: string[]) => void;
  onStepChange?: (stepId: string) => void;
  initialStep?: string;
  className?: string;
}

export function useProgressiveDisclosure(steps: Step[], initialStep?: string) {
  const [activeStep, setActiveStep] = useState(
    initialStep || steps[0]?.id || "",
  );
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const goToStep = useCallback((stepId: string) => {
    setActiveStep(stepId);
  }, []);

  const nextStep = useCallback(() => {
    const currentIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentIndex < steps.length - 1) {
      setActiveStep(steps[currentIndex + 1].id);
    }
  }, [activeStep, steps]);

  const previousStep = useCallback(() => {
    const currentIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentIndex > 0) {
      setActiveStep(steps[currentIndex - 1].id);
    }
  }, [activeStep, steps]);

  const markStepComplete = useCallback((stepId: string) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId) ? prev : [...prev, stepId],
    );
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const isSectionExpanded = useCallback(
    (sectionId: string) => {
      return expandedSections[sectionId] ?? false;
    },
    [expandedSections],
  );

  const isStepCompleted = useCallback(
    (stepId: string) => {
      return completedSteps.includes(stepId);
    },
    [completedSteps],
  );

  const canProceed = useCallback(
    (stepId: string, validator?: () => boolean) => {
      return (
        completedSteps.includes(stepId) || (validator ? validator() : true)
      );
    },
    [completedSteps],
  );

  return {
    activeStep,
    completedSteps,
    expandedSections,
    goToStep,
    nextStep,
    previousStep,
    markStepComplete,
    toggleSection,
    isSectionExpanded,
    isStepCompleted,
    canProceed,
    totalSteps: steps.length,
    currentStepIndex: steps.findIndex((s) => s.id === activeStep),
  };
}

interface AccordionSectionProps {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  isCompleted?: boolean;
  isDisabled?: boolean;
}

export function AccordionSection({
  id,
  title,
  description,
  icon,
  isExpanded,
  onToggle,
  children,
  isCompleted,
  isDisabled,
}: AccordionSectionProps) {
  return (
    <div
      className={`border border-gray-200 rounded-xl overflow-hidden transition-all ${isDisabled ? "opacity-50" : ""}`}
    >
      <button
        onClick={isDisabled ? undefined : onToggle}
        className={`w-full flex items-center gap-4 px-4 py-4 text-left transition-colors ${
          isExpanded ? "bg-blue-50" : "bg-white hover:bg-gray-50"
        } ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        aria-expanded={isExpanded}
        disabled={isDisabled}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isCompleted
              ? "bg-green-100"
              : isExpanded
                ? "bg-blue-100"
                : "bg-gray-100"
          }`}
        >
          {isCompleted ? (
            <MaterialIcon icon="check_circle" className="text-green-600" />
          ) : icon ? (
            <MaterialIcon
              icon={icon}
              className={`${isExpanded ? "text-blue-600" : "text-gray-500"}`}
            />
          ) : (
            <span
              className={`text-sm font-medium ${isExpanded ? "text-blue-600" : "text-gray-500"}`}
            >
              {id.split("-").pop()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`font-medium ${isExpanded ? "text-blue-900" : "text-gray-900"}`}
          >
            {title}
          </div>
          {description && (
            <div className="text-sm text-gray-500 truncate">{description}</div>
          )}
        </div>
        <MaterialIcon
          icon={isExpanded ? "expand_less" : "expand_more"}
          className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && <div className="px-4 pb-4 bg-white">{children}</div>}
    </div>
  );
}

interface MobileFormWizardProps {
  steps: Step[];
  children: ReactNode;
  className?: string;
}

export function MobileFormWizard({
  steps,
  children,
  className,
}: MobileFormWizardProps) {
  const {
    activeStep,
    completedSteps,
    goToStep,
    nextStep,
    previousStep,
    markStepComplete,
    currentStepIndex,
    totalSteps,
  } = useProgressiveDisclosure(steps);

  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {steps[currentStepIndex]?.title}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="min-h-[400px]">{children}</div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={previousStep}
          disabled={currentStepIndex === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            currentStepIndex === 0
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <MaterialIcon icon="arrow_back" />
          Back
        </button>

        <button
          onClick={() => {
            markStepComplete(activeStep);
            if (currentStepIndex < totalSteps - 1) {
              nextStep();
            }
          }}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {currentStepIndex < totalSteps - 1 ? (
            <>
              Next
              <MaterialIcon icon="arrow_forward" />
            </>
          ) : (
            <>
              Complete
              <MaterialIcon icon="check" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default useProgressiveDisclosure;
