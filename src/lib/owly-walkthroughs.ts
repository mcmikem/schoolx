/**
 * Guided walkthroughs, one per role.
 *
 * The goal is that a teacher who has never used any software like this can get
 * through a full day's work without asking anybody. So a walkthrough is not a
 * tour of the interface — it is the shortest path through the tasks that role
 * actually performs, in the order they happen.
 *
 * Each step names the page, what to do there, and how to tell it worked. The
 * "done" test matters most: a new user needs to know what success looks like,
 * otherwise they stop to ask whether it worked.
 *
 * Copy rules: short sentences, common words, one action per sentence. Explain
 * any word that is not everyday English. Keep the app's button names in bold so
 * the user can look for the same words on screen.
 *
 * Steps are written against routes that exist and match the real nav, so a
 * walkthrough never dead-ends a user on a 404.
 */

import type { OnboardingVideoKey } from "@/lib/onboarding-videos";

export interface WalkthroughStep {
  /** Route to send the user to. Omitted for steps done in place. */
  href?: string;
  /**
   * Optional short video for this step. Teachers who would rather watch than
   * read get the same job shown on screen; the text stays for everyone else.
   */
  video?: OnboardingVideoKey;
  /** Imperative, second person, one sentence. */
  title: string;
  /** How to do it. */
  how: string;
  /** How they know it worked — the part that stops the "did that work?" call. */
  done: string;
}

export interface Walkthrough {
  id: string;
  title: string;
  /** Shown before the first step. One line, no marketing. */
  intro: string;
  steps: WalkthroughStep[];
}

/**
 * Keyed by `users.role`. Staff routinely hold several roles (see AGENTS.md), so
 * lookup walks the user's full role list and takes the first match — a headmaster
 * who also teaches gets the headmaster tour.
 */
export const WALKTHROUGHS: Record<string, Walkthrough> = {
  teacher: {
    id: "teacher",
    title: "Your first day, step by step",
    intro: "Do these four jobs in this order. Skip any job you already know.",
    steps: [
      {
        href: "/dashboard/attendance",
        video: "attendance",
        title: "Take the register",
        how: "Open Attendance. Pick your class. Tap a pupil to mark Present, tap again for Absent. Swipe left for Present, right for Absent. Use the row buttons for Late or Excused. If the list is hard to tap, use One pupil at a time.",
        done: "Each pupil's row shows a colour. The numbers at the top count Present, Absent and Late.",
      },
      {
        href: "/dashboard/grades",
        video: "marks",
        title: "Enter marks for your subject",
        how: "Open Grades. Pick the class and your subject. Type each pupil's mark. Move to the next box and it saves.",
        done: "The mark stays in the box. The pupil's total and grade appear next to their name.",
      },
      {
        href: "/dashboard/homework",
        video: "tests",
        title: "Set homework",
        how: "Open Homework. Pick the class and subject. Write the task. Choose the date it is due.",
        done: "The homework appears in the list. You can see how many pupils have handed it in.",
      },
      {
        href: "/dashboard/attendance",
        title: "Ask the office to reach a parent",
        how: "Teachers do not send parent messages -- the head office sends notices and SMS. Mark what happened in Attendance or Report Cards, then tell the office what the parent needs to hear.",
        done: "The office has the detail and confirms the parent was told.",
      },
    ],
  },

  headmaster: {
    id: "headmaster",
    title: "Your first week as headmaster",
    intro: "Set up the school once. Then check that it works. After that, most days are routine.",
    steps: [
      {
        href: "/dashboard/settings",
        title: "Finish the setup wizard",
        how: "Open Settings. Run the setup wizard. It asks for terms, grading and fees. The rest of the app uses these answers.",
        done: "The wizard says it is complete. Your dashboard numbers stop showing zero.",
      },
      {
        href: "/dashboard/staff",
        title: "Add your staff",
        how: "Open Staff. Add each person. Tick every role they do. A teacher who is also a parent gets both roles.",
        done: "Each person appears in the staff list. They can sign in with the email you gave.",
      },
      {
        href: "/dashboard/students",
        title: "Bring the pupils in",
        how: "Open Students. Add one pupil, or import a spreadsheet for a whole class. The app tells you which rows it skipped and why.",
        done: "Every pupil is in the right class. Each one has a student number.",
      },
      {
        href: "/dashboard/reports",
        title: "Print the first report cards",
        how: "Open Reports. Choose the term and class. Write the head teacher remarks. You can write them for the whole class at once, then edit only the ones you want. Preview before you print.",
        done: "The preview matches the Uganda report format. It shows your school name, logo and colours.",
      },
    ],
  },

  bursar: {
    id: "bursar",
    title: "Fees and payments, start to finish",
    intro: "This is the money path: set the fee, take the money, give a receipt, then follow up.",
    steps: [
      {
        href: "/dashboard/fee-structure",
        title: "Set the fee structure",
        how: "Open Fee Structure. Add what each class pays for the term. You can add items like tuition and development.",
        done: "Each class shows what one pupil owes for this term.",
      },
      {
        href: "/dashboard/fees",
        title: "Record a payment",
        how: "Open Fees. Tap the pupil. Tap Payments. Tap Record Payment. Type the amount and how it was paid.",
        done: "The balance goes down. A receipt appears under that pupil's payments.",
      },
      {
        href: "/dashboard/fees",
        title: "Record a payment that is not cash",
        how: "Use the same Record Payment form. Choose Mobile Money, Bank Transfer or another way. For mobile money, type the transaction ID from the parent's phone.",
        done: "The payment shows under the right payment method in the fee report.",
      },
      {
        href: "/dashboard/fees",
        title: "Send a reminder to those who have not paid",
        how: "Open Fees. Select the pupils who still owe money. Tap Send Reminder. It goes by SMS to their parents.",
        done: "The reminder shows Sent or Queued, with the date.",
      },
    ],
  },

  admin: {
    id: "admin",
    title: "Setting the school up",
    intro: "Do these jobs in this order. It saves you from coming back to fix things later.",
    steps: [
      {
        href: "/dashboard/settings",
        title: "Run the setup wizard",
        how: "Open Settings. Run the setup wizard. It asks for terms, grading, fees and the report layout.",
        done: "The wizard says it is complete.",
      },
      {
        href: "/dashboard/settings",
        title: "Create classes",
        how: "Open Settings. Create each class. Choose one class teacher for each class. Marks and reports follow the class.",
        done: "The classes appear in the dropdown on Attendance, Grades and Reports.",
      },
      {
        href: "/dashboard/staff",
        title: "Add staff",
        how: "Open Staff. Add each person. Tick every role they do.",
        done: "They can sign in. They see only the pages their roles allow.",
      },
      {
        href: "/dashboard/students",
        title: "Import pupils",
        how: "Open Students. Use the spreadsheet import for a whole class. The app tells you which rows it skipped and why.",
        done: "Every pupil is in the right class. The class list is complete.",
      },
    ],
  },
};

/**
 * Which walkthrough wins when someone holds several roles.
 *
 * Seniority, not array order. Rural staff routinely double up, and the order in
 * which roles reach us is not meaningful -- it is whatever the profile happened
 * to store first. Without an explicit order a headmaster who also teaches could
 * be handed the classroom tour and left with no idea where school-wide setup
 * lives, purely because "teacher" happened to be indexed first.
 */
export const WALKTHROUGH_PRIORITY: readonly string[] = ["headmaster", "admin", "bursar", "teacher"];

/**
 * Pick the walkthrough for a user holding one or more roles.
 *
 * Highest-priority known role wins, regardless of the order roles were passed
 * in. Returns null when nothing matches, so the caller can fall back.
 */
export function pickWalkthrough(roles: readonly string[] | undefined | null): Walkthrough | null {
  const held = new Set((roles ?? []).filter((role): role is string => typeof role === "string" && role.length > 0));
  for (const role of WALKTHROUGH_PRIORITY) {
    if (held.has(role)) return WALKTHROUGHS[role];
  }
  // A role with no tour of its own still beats nothing, but never beats a real
  // tour -- handled above by only falling through when none matched.
  return null;
}

export const FALLBACK_WALKTHROUGH: Walkthrough = {
  id: "general",
  title: "Getting around",
  intro: "These are the four screens you will use most.",
  steps: [
    {
      href: "/dashboard",
      title: "Your dashboard",
      how: "The numbers at the top are for today. Tap a number to see the details behind it.",
      done: "You can see your school, the current term and today's numbers.",
    },
    {
      href: "/dashboard/attendance",
      title: "The register",
      how: "Open Attendance. Tap a pupil to mark Present. Swipe right for Absent. Swipe left for Late. It works without signal.",
      done: "Each pupil's row shows a colour.",
    },
    {
      title: "Finding anything",
      how: "Use the search box at the top of the sidebar. Type two or three letters of the page name.",
      done: "The pages that match appear as you type.",
    },
    {
      title: "Asking Owly",
      how: "Tap Owly in the bottom right corner. Ask your question in your own words. Owly answers even without internet.",
      done: "You get an answer with steps and a link to the page.",
    },
  ],
};
