"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import MaterialIcon from "@/components/MaterialIcon";
import {
  ONBOARDING_VIDEOS,
  onboardingPosterUrl,
  onboardingVideoUrl,
  type OnboardingVideoKey,
} from "@/lib/onboarding-videos";

/**
 * "Watch it" button + modal player for the teacher onboarding clips.
 *
 * The video element is not mounted until the user asks for it: the poster is
 * a plain image, so the page costs ~50 KB and a teacher on a slow connection
 * is never billed for a video they did not choose.
 */
export function VideoLessonButton({
  lesson,
  label,
  className = "",
}: {
  lesson: OnboardingVideoKey;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = ONBOARDING_VIDEOS[lesson];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-video-lesson={lesson}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)] ${className}`}
      >
        <MaterialIcon icon="play_circle" size={18} className="text-[var(--primary)]" />
        <span>{label ?? `Watch how (${meta.duration}s)`}</span>
      </button>
      {open ? <VideoLessonModal lesson={lesson} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VideoLessonModal({ lesson, onClose }: { lesson: OnboardingVideoKey; onClose: () => void }) {
  const meta = ONBOARDING_VIDEOS[lesson];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // The <video> element is always mounted (without a source, so nothing is
  // downloaded). Starting it from the click keeps the browser's autoplay
  // gesture rule happy — the user tapped, so it plays with sound.
  const startPlayback = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = onboardingVideoUrl(lesson);
    v.load();
    void v.play().catch(() => {
      /* the user can still press play on the native controls */
    });
    setPlaying(true);
  }, [lesson]);

  const close = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      // Release the connection so the file stops downloading.
      v.removeAttribute("src");
      v.load();
    }
    setPlaying(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={meta.title}
      onClick={close}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--t1)]">{meta.title}</h2>
            <p className="mt-0.5 text-sm text-[var(--t3)]">{meta.blurb}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close video"
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--t3)] transition-colors hover:bg-[var(--surface-container-low)]"
          >
            <MaterialIcon icon="close" size={20} />
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            poster={onboardingPosterUrl(lesson)}
            controls={playing}
            playsInline
            preload="none"
            className="h-full w-full"
          />
          {!playing ? (
            <button
              type="button"
              onClick={startPlayback}
              className="group absolute inset-0 block h-full w-full"
              aria-label={`Play: ${meta.title}`}
            >
              <Image
                src={onboardingPosterUrl(lesson)}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[var(--primary)] shadow-lg transition-transform group-hover:scale-105">
                  <MaterialIcon icon="play_arrow" size={32} />
                </span>
              </span>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                {meta.duration}s
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-xs text-[var(--t4)]">{meta.surface} · video uses your data allowance</p>
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--t2)] transition-colors hover:bg-[var(--surface-container-low)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
