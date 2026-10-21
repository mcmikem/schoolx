"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import MaterialIcon from "@/components/MaterialIcon";
import { Modal } from "@/components/ui/Modal";
import {
  ONBOARDING_VIDEOS,
  onboardingPosterUrl,
  onboardingVideoUrl,
  type OnboardingVideoKey,
} from "@/lib/onboarding-videos";

/**
 * "Watch it" button + player for the teacher onboarding clips.
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

/** Poster card used on the marketing site: a thumbnail that opens the player. */
export function VideoLessonCard({
  lesson,
  title,
  blurb,
}: {
  lesson: OnboardingVideoKey;
  title?: string;
  blurb?: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = ONBOARDING_VIDEOS[lesson];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-video-lesson={lesson}
        className="group block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-green)]/40 hover:shadow-md"
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-slate-900">
          <Image
            src={onboardingPosterUrl(lesson)}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 380px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/25 transition-colors group-hover:bg-slate-950/35">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
              <MaterialIcon icon="play_arrow" size={28} />
            </span>
          </span>
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-slate-950/75 px-2 py-0.5 text-[11px] font-semibold text-white">
            {meta.duration}s
          </span>
        </span>
        <span className="block px-4 py-3.5">
          <span className="block text-sm font-semibold text-slate-900">{title ?? meta.title}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">{blurb ?? meta.blurb}</span>
        </span>
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
  // gesture rule happy -- the user tapped, so it plays with sound.
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

  // Note: no unmount cleanup effect here. `close` is recreated on every
  // render, so an effect depending on it would fire its cleanup immediately
  // and close the modal the moment it opened. Removing the <video> from the
  // DOM already stops the download.

  return (
    <Modal isOpen onClose={close} size="xl" showClose={false} className="max-w-3xl">
      <div className="-m-6">
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
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[var(--primary)] shadow-lg transition-transform group-hover:scale-105">
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
    </Modal>
  );
}
