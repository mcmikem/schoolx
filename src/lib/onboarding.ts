// Offboarding / onboarding state + server persistence
// Used by the new RoleAwareOverlay + Teacher/Bursar step flows.

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

export type OnboardingRole = "teacher" | "bursar" | "admin";

export interface OnboardingState {
  isComplete: boolean;
  role: OnboardingRole | null;
  currentStep: number;
  totalSteps: number;
  showOverlay: boolean;
}

// ---------- Client-side onboarding state ----------

const STORAGE_KEY = "skm_onboarding_skipped";

const isStorageSkipped = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const markStorageSkipped = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
};

// ---------- Hook ----------

export function useOnboarding() {
  const { user } = useAuth();
  const toast = useToast();

  const [state, setState] = useState<{
    isComplete: boolean;
    role: OnboardingRole | null;
    currentStep: number;
    totalSteps: number;
    showOverlay: boolean;
  }>({
    isComplete: false,
    role: null,
    currentStep: 1,
    totalSteps: 1,
    showOverlay: false,
  });

  // 1. On mount: check local storage for skipped flag
  useEffect(() => {
    if (!user?.id) {
      setState((s) => ({ ...s, isComplete: false, role: null, showOverlay: false }));
      return;
    }

    if (isStorageSkipped()) {
      setState((s) => ({ ...s, isComplete: true, role: null, showOverlay: false }));
      return;
    }

    // Determine role flow based on user role
    const role = user?.role as OnboardingRole | null;
    const validRoles: OnboardingRole[] = ["teacher", "bursar", "admin"];

    if (role && validRoles.includes(role)) {
      setState((s) => ({ ...s, isComplete: false, role, showOverlay: true }));
    } else {
      // No recognized role — treat as complete
      setState((s) => ({ ...s, isComplete: true, role: null, showOverlay: false }));
    }
  }, [user?.id]);

  // 2. Mark onboarding as skipped (storage only)
  const skipOnboarding = () => {
    markStorageSkipped();
    setState((s) => ({ ...s, isComplete: true, role: null, showOverlay: false }));
  };

  return {
    state,
    skipOnboarding,
    isComplete: state.isComplete,
    role: state.role,
    showOverlay: state.showOverlay,
    currentStep: state.currentStep,
    totalSteps: state.totalSteps,
  };
}
