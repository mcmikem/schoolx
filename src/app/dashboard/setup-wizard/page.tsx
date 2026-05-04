"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { OwlLoader } from "@/components/loaders";

export default function SetupWizardPage() {
  const router = useRouter();
  const { user, school, authInitialized } = useAuth();

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <OwlLoader size={100} text="SkoolMate OS" subtext="Loading your school..." />
      </div>
    );
  }

  if (!user || !school) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--t1)] mb-2">Please sign in</h2>
          <p className="text-sm text-[var(--t3)] mb-4">You need to be logged in to set up your school.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl font-medium"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <OnboardingFlow onComplete={() => router.push("/dashboard")} />
    </PageErrorBoundary>
  );
}
