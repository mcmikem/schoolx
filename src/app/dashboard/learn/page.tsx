"use client";

import Link from "next/link";
import LearningGuide from "@/components/onboarding/LearningGuide";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { learningTracks } from "@/lib/learning-guide";

export default function LearnPage() {
  const { user, school } = useAuth();
  return (
    <div className="content min-w-0 pb-24">
      <PageHeader
        title="Learn step by step"
        subtitle="Read a little. Try an example. Go at your own pace."
        actions={
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base font-semibold"
          >
            Back to Home
          </Link>
        }
      />
      <p className="text-base leading-relaxed text-[var(--t2)]">
        Learn with pretend records before using your school’s real records. No videos are needed.
      </p>
      {user?.id && school?.id ? (
        <LearningGuide
          key={`${school.id}:${user.id}`}
          schoolId={school.id}
          userId={user.id}
          tracks={learningTracks(user)}
        />
      ) : (
        <p role="status">Waiting for your school account…</p>
      )}
    </div>
  );
}
