"use client";
import { useState } from "react";
import PersonInitials from "@/components/ui/PersonInitials";

/**
 * Roll-call face: the pupil's photo at a size worth recognizing across a
 * desk, falling back to initials when no photo was ever uploaded (or the
 * stored URL died).
 *
 * The image MUST NOT participate in native drag: <img> is draggable by
 * default, and on both iOS and Android a touch-drag starting on a photo is
 * hijacked for image-drag/long-press callout — the browser fires
 * touchcancel and any swipe gesture on the row dies silently. draggable +
 * onDragStart + pointer-events:none keep every touch on the row itself, so
 * swipe-to-mark works wherever a face is showing.
 */
export function RollCallPhoto({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!photoUrl || broken) {
    return <PersonInitials name={name} size={56} />;
  }
  return (
    <img
      src={photoUrl}
      alt={name}
      loading="lazy"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onError={() => setBroken(true)}
      className="w-14 h-14 rounded-full object-cover flex-shrink-0 bg-surface-container pointer-events-none"
    />
  );
}
