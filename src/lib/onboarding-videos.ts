/**
 * Teacher onboarding clips.
 *
 * Each clip is a short (25-35s) screen recording of the real teacher flow,
 * rendered in the video template and hosted in the public `app-videos`
 * Supabase bucket (see `scripts/upload-onboarding-videos.mjs`).
 *
 * The clips are opt-in: nothing is downloaded until the user taps play, so a
 * teacher on a metered or slow connection never pays for video they did not
 * ask for.
 */

export type OnboardingVideoKey = "attendance" | "marks" | "comments" | "tests";

export type OnboardingVideo = {
  key: OnboardingVideoKey;
  /** Button + modal title */
  title: string;
  /** One line of context under the title */
  blurb: string;
  /** Seconds, shown next to the play button */
  duration: number;
  /** Where this clip is relevant */
  surface: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gucxpmgwvnbqykevucbi.supabase.co";
const BUCKET = "app-videos";
const PREFIX = "onboarding";

const asset = (file: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/${file}`;

export const ONBOARDING_VIDEOS: Record<OnboardingVideoKey, OnboardingVideo> = {
  attendance: {
    key: "attendance",
    title: "Marking the register",
    blurb: "Pick your class, tap Present on each pupil — or mark everyone at once — and save.",
    duration: 33,
    surface: "Attendance",
  },
  marks: {
    key: "marks",
    title: "Entering the term's marks",
    blurb: "BOT, mid-term and end-of-term scores go in once; averages and grades work themselves out.",
    duration: 33,
    surface: "Grades & marks",
  },
  comments: {
    key: "comments",
    title: "Writing report comments",
    blurb: "Generate a comment for every pupil, then edit any line in your own words.",
    duration: 35,
    surface: "Report cards",
  },
  tests: {
    key: "tests",
    title: "Setting class tests",
    blurb: "Add a test with its topic and total marks — the class sees it on time.",
    duration: 28,
    surface: "Class tests",
  },
};

const slug = (key: OnboardingVideoKey) =>
  key === "comments" ? "teacher-report-comments" : key === "tests" ? "teacher-class-tests" : `teacher-${key}`;

export const onboardingVideoUrl = (key: OnboardingVideoKey) => asset(`${slug(key)}.mp4`);

export const onboardingPosterUrl = (key: OnboardingVideoKey) => asset(`${slug(key)}.jpg`);

/**
 * The 480p rendition, for slow or metered connections.
 *
 * Measured over the real CDN: at 400 kbps (Slow 3G) the 720p file takes
 * ~30-36s to arrive for a ~33s clip, so playback stalls. The 480p file is
 * about half the bytes and keeps up.
 */
export const onboardingVideoLiteUrl = (key: OnboardingVideoKey) => asset(`${slug(key)}-lite.mp4`);

/**
 * Pick the smallest rendition that still plays at the user's connection.
 *
 * `navigator.connection` is Chromium-only; everywhere else the full quality
 * file is used, which is the right default for a fast connection.
 */
export function preferredOnboardingVideoUrl(key: OnboardingVideoKey): string {
  if (typeof navigator === "undefined") return onboardingVideoUrl(key);
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (!connection) return onboardingVideoUrl(key);
  if (connection.saveData) return onboardingVideoLiteUrl(key);
  const type = connection.effectiveType;
  if (type === "slow-2g" || type === "2g" || type === "3g") return onboardingVideoLiteUrl(key);
  return onboardingVideoUrl(key);
}
