"use client";

import { FadeIn } from "@/components/marketing/FadeIn";
import { VideoLessonCard } from "@/components/onboarding/VideoLesson";
import type { OnboardingVideoKey } from "@/lib/onboarding-videos";

/**
 * The four teacher jobs, as short clips.
 *
 * On the marketing site this is the fastest way to answer "what does this
 * actually do for a teacher?" -- no signup, no tour request, just the four
 * things a teacher does every week.
 */
const CLIPS: { lesson: OnboardingVideoKey; title: string; blurb: string }[] = [
  {
    lesson: "attendance",
    title: "Mark the register",
    blurb: "Pick your class, tap Present on each pupil, save. Works without signal.",
  },
  {
    lesson: "marks",
    title: "Enter the term's marks",
    blurb: "One grid for every pupil. Averages and grades work themselves out.",
  },
  {
    lesson: "comments",
    title: "Write report comments",
    blurb: "A comment for every pupil, drafted from real results, editable in your words.",
  },
  {
    lesson: "tests",
    title: "Set class tests",
    blurb: "Add the topic and the total marks. The class sees it on the day.",
  },
  {
    lesson: "fees",
    title: "Record a fee payment",
    blurb: "Find the pupil, enter amount and method — receipt saved, balance updated.",
  },
  {
    lesson: "timetable",
    title: "Build the class timetable",
    blurb: "Set the bell day, assign subjects, then print for the class.",
  },
  {
    lesson: "qrAttendance",
    title: "Scan a student ID card",
    blurb: "Open the scanner, point at the card — attendance marked in one tap.",
  },
  {
    lesson: "library",
    title: "Find a book in the library",
    blurb: "Search the catalogue, borrow in one tap, track returns.",
  },
  {
    lesson: "reportCards",
    title: "Print report cards",
    blurb: "Choose term and class, write remarks, preview, then print.",
  },
  {
    lesson: "homework",
    title: "Set homework",
    blurb: "Pick class and subject, write the task and due date.",
  },
];

export function VideoTourSection() {
  return (
    <section id="clips" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
      <FadeIn>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand-ink)]">See it working</p>
          <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
            A teacher&apos;s week, in four short clips.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            No slides, no narration. These are the real screens, doing the real job. Thirty seconds each, and you can
            watch them before you sign up.
          </p>
        </div>
      </FadeIn>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CLIPS.map((clip, i) => (
          <FadeIn key={clip.lesson} delay={i * 70}>
            <VideoLessonCard lesson={clip.lesson} title={clip.title} blurb={clip.blurb} />
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
