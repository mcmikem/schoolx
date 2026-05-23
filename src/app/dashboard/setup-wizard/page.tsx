"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { OwlLoader } from "@/components/loaders";
import { APP_NAME } from "@/lib/app-name";

export default function SetupWizardPage() {
  const router = useRouter();
  const { user, school, authInitialized } = useAuth();

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <OwlLoader size={84} text={APP_NAME} subtext="Loading your school..." />
        </div>
      </div>
    );
  }

  if (!user || !school) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-[var(--t1)]">Please sign in</h2>
          <p className="text-sm text-[var(--t3)]">You need to be logged in to set up your school.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl font-medium w-full"
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
