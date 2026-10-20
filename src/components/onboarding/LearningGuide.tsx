"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { formatCurrency } from "@/lib/currency";
import { toLocalDateString } from "@/lib/date-utils";
import {
  learningLessons,
  learningStorageKey,
  readLearningProgress,
  TRACK_LABELS,
  type LearningProgress,
  type LearningTrack,
} from "@/lib/learning-guide";

function AttendancePractice() {
  const [absent, setAbsent] = useState(false);
  return (
    <div className="space-y-3">
      <p className="font-bold">P.3 practice register</p>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <span>Amina</span>
        <span className="font-semibold text-emerald-800">Present</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 font-semibold">John</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="John’s practice attendance">
          <button
            type="button"
            aria-pressed={!absent}
            onClick={() => setAbsent(false)}
            className={`min-h-12 flex-1 rounded-xl border px-3 ${!absent ? "border-emerald-700 bg-emerald-50 font-bold text-emerald-900" : "border-slate-300"}`}
          >
            Present
          </button>
          <button
            type="button"
            aria-pressed={absent}
            onClick={() => setAbsent(true)}
            className={`min-h-12 flex-1 rounded-xl border px-3 ${absent ? "border-amber-700 bg-amber-50 font-bold text-amber-900" : "border-slate-300"}`}
          >
            Absent
          </button>
        </div>
      </div>
      <p role="status" className="text-sm leading-relaxed">
        {absent
          ? "That is right. John is marked absent in this example. Your school’s register has not changed."
          : "Try it: John did not come to school. Tap Absent."}
      </p>
    </div>
  );
}

function PaymentPractice() {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toLocalDateString());
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const value = Number(amount.replace(/[,\s]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(value) && value > 0 && value <= 50000;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          setError("Enter an amount from 1 to 50,000 shillings for this example.");
          return;
        }
        if (!date || date > toLocalDateString()) {
          setError("Choose today or an earlier payment date.");
          return;
        }
        setError("");
        setSaved(true);
      }}
      className="space-y-4"
    >
      <div>
        <p className="font-bold">Amina Namatovu · P.3</p>
        <p className="mt-1 text-sm">Example balance: UGX 50,000 · Cash payment</p>
      </div>
      <div>
        <label htmlFor="practice-payment-amount" className="mb-2 block font-semibold">
          Amount paid (UGX)
        </label>
        <input
          id="practice-payment-amount"
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          placeholder="For example, 20000"
          onChange={(event) => {
            setAmount(event.target.value);
            setSaved(false);
            setError("");
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "practice-payment-error" : undefined}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="practice-payment-date" className="mb-2 block font-semibold">
          Date the money was paid
        </label>
        <input
          id="practice-payment-date"
          type="date"
          max={toLocalDateString()}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSaved(false);
            setError("");
          }}
          className="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
        />
      </div>
      {valid && (
        <p>
          Amount left: <strong>{formatCurrency(50000 - value)}</strong>
        </p>
      )}
      {error && (
        <p id="practice-payment-error" role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
      <button type="submit" className="min-h-12 w-full rounded-xl bg-[#17325f] px-4 font-bold text-white">
        Save practice receipt
      </button>
      {saved && (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
          Practice receipt saved for {formatCurrency(value)}. No real payment was recorded.
        </p>
      )}
    </form>
  );
}

function GuideSession({ schoolId, userId, track }: { schoolId: string; userId: string; track: LearningTrack }) {
  const lessons = learningLessons(track);
  const storageKey = learningStorageKey(schoolId, userId, track);
  const [progress, setProgress] = useState<LearningProgress>(() => readLearningProgress(null, lessons));
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [online, setOnline] = useState(true);
  const [showLessons, setShowLessons] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    try {
      setProgress(readLearningProgress(localStorage.getItem(storageKey), lessons));
    } catch {
      setStorageUnavailable(true);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      setStorageUnavailable(true);
    }
  }, [ready, storageKey, progress]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (moveFocus.current) {
      heading.current?.focus();
      moveFocus.current = false;
    }
  }, [progress.lessonId, progress.step]);

  const lesson = lessons.find((item) => item.id === progress.lessonId) || lessons[0];
  const step = lesson.steps[progress.step] || lesson.steps[0];
  const reviewed = progress.reviewed.includes(lesson.id);
  const lastStep = progress.step === lesson.steps.length - 1;
  const nextUnread = lessons.find((item) => item.id !== lesson.id && !progress.reviewed.includes(item.id));
  const change = (lessonId: string, index: number) => {
    setShowLessons(false);
    moveFocus.current = true;
    setProgress((previous) => ({ ...previous, lessonId, step: index }));
    heading.current?.focus();
  };
  if (!ready)
    return (
      <p role="status" className="p-4">
        Opening your guide…
      </p>
    );

  return (
    <div className="space-y-5">
      <div role="status" className="text-sm leading-relaxed text-[var(--t2)]">
        {storageUnavailable
          ? "This phone cannot keep your place. You can still use every lesson, but may need to start again after closing the page."
          : "Your place is kept on this phone for this account. You can leave and come back."}
        {!online && (
          <p className="mt-2 font-semibold">
            You are offline. These open lessons still work. Real school records need the app’s normal save and sync
            checks.
          </p>
        )}
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <nav
          aria-label="Learning lessons"
          className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <p className="font-bold text-[var(--t1)]">{TRACK_LABELS[track]}</p>
          <p className="mt-1 text-sm text-[var(--t3)]">
            {progress.reviewed.length} of {lessons.length} lessons read
          </p>
          <p className="mt-2 hidden text-sm text-[var(--t3)] lg:block">Choose a lesson. You can repeat any of them.</p>
          <button
            type="button"
            aria-expanded={showLessons}
            aria-controls="learning-lesson-list"
            onClick={() => setShowLessons((previous) => !previous)}
            className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-[var(--border)] px-3 text-base font-semibold lg:hidden"
          >
            Choose a lesson
            <MaterialIcon icon={showLessons ? "expand_less" : "expand_more"} />
          </button>
          <ol id="learning-lesson-list" className={`mt-4 space-y-2 ${showLessons ? "block" : "hidden"} lg:block`}>
            {lessons.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => change(item.id, 0)}
                  aria-current={item.id === lesson.id ? "step" : undefined}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left text-base ${item.id === lesson.id ? "border-[#17325f] bg-blue-50 font-bold text-[#17325f]" : "border-[var(--border)] text-[var(--t1)]"}`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-sm font-bold"
                    aria-hidden="true"
                  >
                    {progress.reviewed.includes(item.id) ? <MaterialIcon icon="check" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.title}
                    {progress.reviewed.includes(item.id) && (
                      <span className="block text-xs font-normal">Read — tap to repeat</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section
          aria-label="Current lesson"
          className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--t2)]">
            <MaterialIcon icon={lesson.icon} />
            <span>
              Step {progress.step + 1} of {lesson.steps.length}
            </span>
          </div>
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-xl font-bold leading-snug text-[var(--t1)] focus:outline-none"
          >
            {step.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--t2)]">{step.instruction}</p>
          <div
            aria-label="Practice example"
            className="my-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-base text-slate-900"
          >
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-600">
              <MaterialIcon icon="school" />
              Example only — not your school records
            </p>
            <div key={`${lesson.id}-${progress.step}`}>
              {step.practice === "attendance" ? (
                <AttendancePractice />
              ) : step.practice === "payment" ? (
                <PaymentPractice />
              ) : (
                <ol className="space-y-3">
                  {step.example.map((line, index) => (
                    <li key={line} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-[#17325f]"
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
            <strong>Remember: </strong>
            {step.tip}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={progress.step === 0}
              onClick={() => change(lesson.id, progress.step - 1)}
              className="min-h-12 rounded-xl border border-[var(--border)] px-5 text-base font-semibold text-[var(--t1)] disabled:opacity-40"
            >
              Back
            </button>
            {lastStep && reviewed ? (
              nextUnread ? (
                <button
                  type="button"
                  onClick={() => change(nextUnread.id, 0)}
                  className="min-h-12 flex-1 rounded-xl bg-[#17325f] px-4 text-base font-bold text-white"
                >
                  Next lesson →
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#17325f] px-4 text-base font-bold text-white"
                >
                  All lessons read — go Home
                </Link>
              )
            ) : lastStep ? (
              <button
                type="button"
                onClick={() =>
                  setProgress((previous) => ({
                    ...previous,
                    reviewed: [...new Set([...previous.reviewed, lesson.id])],
                  }))
                }
                className="min-h-12 min-w-0 flex-1 rounded-xl bg-[#17325f] px-4 text-base font-bold text-white"
              >
                Mark this lesson as read
              </button>
            ) : (
              <button
                type="button"
                onClick={() => change(lesson.id, progress.step + 1)}
                className="min-h-12 flex-1 rounded-xl bg-[#17325f] px-5 text-base font-bold text-white"
              >
                Next step <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          {lastStep && reviewed && (
            <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">
              Lesson read. Choose another lesson when you are ready. Your school records have not changed.
            </p>
          )}
          {lesson.href && (
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-sm text-[var(--t3)]">
                Ready to try it for real? This opens your school&apos;s page. The guide will keep your place.
              </p>
              <Link
                href={lesson.href}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-base font-semibold text-[var(--primary)]"
              >
                {lesson.action}
                <MaterialIcon icon="arrow_forward" />
              </Link>
            </div>
          )}
        </section>
      </div>
      <p className="text-sm leading-relaxed text-[var(--t3)]">
        Lessons marked as read are not proof that school setup, payments or attendance are complete. Check the real
        records separately.
      </p>
    </div>
  );
}

export default function LearningGuide({
  schoolId,
  userId,
  tracks,
}: {
  schoolId: string;
  userId: string;
  tracks: LearningTrack[];
}) {
  const [track, setTrack] = useState(tracks[0]);
  const selected = tracks.includes(track) ? track : tracks[0];
  return (
    <>
      {tracks.length > 1 && (
        <div className="mb-5">
          <label htmlFor="learning-role" className="mb-2 block text-base font-semibold">
            What would you like to learn?
          </label>
          <select
            id="learning-role"
            value={selected}
            onChange={(event) => setTrack(event.target.value as LearningTrack)}
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-base"
          >
            {tracks.map((item) => (
              <option key={item} value={item}>
                {TRACK_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
      )}
      <GuideSession key={`${schoolId}:${userId}:${selected}`} schoolId={schoolId} userId={userId} track={selected} />
    </>
  );
}
