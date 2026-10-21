/**
 * When Owly should speak up.
 *
 * The rule this file exists to enforce: Owly is silent by default. A blinking
 * button that cries wolf gets ignored within a day, and once a guide is
 * background noise it is worse than no guide at all. So every suggestion below
 * has to justify itself against a real signal — unsynced work the user cannot
 * see, a first run, or someone demonstrably going round in circles.
 *
 * Two rules shape the shape of it:
 *
 *   1. Nothing is suggested because it is "interesting". If the user has no
 *      problem to solve, they get silence.
 *   2. Nothing is suggested that the user cannot act on. Every suggestion
 *      carries either a link or a concrete next action.
 *
 * Pure and synchronous so it can be tested exhaustively — the expensive part
 * (gathering signals) lives in the hook.
 */

export type SuggestionKind = "first-run" | "stuck" | "unblocked";

export interface OwlySuggestion {
  /** Stable across renders, so the UI can key off it. */
  id: string;
  kind: SuggestionKind;
  /** Headline for the question-mark popup. A question, not a notification. */
  title: string;
  /** What to actually do. One or two sentences. */
  detail: string;
  /** Deep link, when the next step is somewhere else. */
  href?: string;
  cta: string;
}

export interface SuggestionSignals {
  /** Current route, e.g. "/dashboard/attendance". */
  page?: string;
  role?: string;
  online: boolean;
  /** Records written offline that have not reached the server yet. */
  pendingSyncCount: number;
  /** Times this exact page has been opened by this user. */
  visitsThisPage: number;
  /** Times the app has been opened by this user. */
  totalVisits: number;
  /** Signed in before, ever. */
  isNewUser: boolean;
}

/**
 * How many times a user has to come back to the same page before we assume
 * they are stuck rather than simply reading.
 *
 * Three is deliberate. Once is "I just arrived"; twice is "I came back, which
 * means I was interrupted". Only the third visit says "I have been here three
 * times and still have not done the thing".
 */
export const STUCK_VISIT_THRESHOLD = 3;

/**
 * The same reasoning for the app as a whole: repeated returns to a page that
 * has nothing on it are the classic "where do I start" moment.
 */
const UNBLOCKED_PAGES: Array<{ match: RegExp; suggestion: OwlySuggestion }> = [
  {
    match: /\/dashboard\/attendance/,
    suggestion: {
      id: "attendance-first",
      kind: "unblocked",
      title: "Not sure where to start with attendance?",
      detail:
        "Tap a pupil's row to mark them Present. Swipe right for Absent. Swipe left for Late. If the list is crowded, use One pupil at a time.",
      cta: "Show me how to mark attendance",
    },
  },
  {
    match: /\/dashboard\/fees/,
    suggestion: {
      id: "fees-first",
      kind: "unblocked",
      title: "Recording your first payment?",
      detail:
        "Open a pupil. Tap Payments. Tap Record Payment. Type the amount and how it was paid. The app makes the receipt number for you.",
      cta: "Walk me through a payment",
    },
  },
  {
    match: /\/dashboard\/grades|\/dashboard\/marks/,
    suggestion: {
      id: "grades-first",
      kind: "unblocked",
      title: "Where do I enter marks?",
      detail: "Choose a class. Tap a subject. Type the marks. They save as you move from box to box.",
      cta: "Walk me through entering marks",
    },
  },
  {
    match: /\/dashboard\/students/,
    suggestion: {
      id: "students-first",
      kind: "unblocked",
      title: "Adding pupils one by one?",
      detail:
        "For a whole class, import a spreadsheet instead. It is faster, and you can fix mistakes before you save.",
      cta: "Show me how to import pupils",
    },
  },
  {
    match: /\/dashboard\/reports|\/dashboard\/report-cards/,
    suggestion: {
      id: "reports-first",
      kind: "unblocked",
      title: "Printing report cards?",
      detail:
        "Set up terms and grades once. Then every card fills in by itself. You can write the head teacher remarks for the whole class at once.",
      cta: "Walk me through report cards",
    },
  },
];

/**
 * Returns the suggestions that are actually warranted, most urgent first.
 * Empty array means Owly stays quiet and does not blink.
 */
export function getSuggestions(signals: SuggestionSignals): OwlySuggestion[] {
  const out: OwlySuggestion[] = [];

  // ── Unsynced work is the only genuinely urgent one ──────────────────────
  // The user cannot see their own writes while offline, so this is the single
  // case where interrupting is the right call. If the connection is back and
  // the queue is draining, there is nothing to say.
  if (!signals.online && signals.pendingSyncCount > 0) {
    out.push({
      id: "sync-pending",
      kind: "unblocked",
      title: `${signals.pendingSyncCount} ${signals.pendingSyncCount === 1 ? "change is" : "changes are"} waiting to sync`,
      detail:
        "You are offline. Everything you enter is saved on this device and uploads by itself once there is signal — nothing is lost.",
      cta: "What syncs offline?",
    });
  }

  // ── First run ───────────────────────────────────────────────────────────
  // One time only, and only for someone who has genuinely never used the app.
  if (signals.isNewUser) {
    out.push({
      id: "first-run",
      kind: "first-run",
      title: "New here?",
      detail:
        "I can walk you through the main jobs your role does, in about two minutes. You can skip it and come back any time.",
      cta: "Show me around",
    });
  }

  // ── Been round this loop a few times ────────────────────────────────────
  // Deliberately narrow: only for a recognised page, only after the threshold,
  // and never on the very first run (the walkthrough already covers it).
  if (!signals.isNewUser && signals.visitsThisPage >= STUCK_VISIT_THRESHOLD) {
    const match = UNBLOCKED_PAGES.find((entry) => entry.match.test(signals.page ?? ""));
    if (match) {
      out.push({ ...match.suggestion, id: `${match.suggestion.id}-repeat` });
    }
  }

  // ── Offline with nothing queued ─────────────────────────────────────────
  // Only after a couple of sessions, so it does not lecture someone who has
  // simply not run into the issue yet.
  if (!signals.online && signals.pendingSyncCount === 0 && signals.totalVisits > 2) {
    out.push({
      id: "offline-brief",
      kind: "stuck",
      title: "Working without signal",
      detail:
        "Attendance, marks and payments all keep working offline. Only sending SMS and sharing needs a connection.",
      cta: "What works offline?",
    });
  }

  return out;
}

/** True when Owly has something worth interrupting for. */
export function hasSuggestion(signals: SuggestionSignals): boolean {
  return getSuggestions(signals).length > 0;
}
