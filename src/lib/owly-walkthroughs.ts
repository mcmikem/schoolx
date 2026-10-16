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
 * Steps are written against routes that exist and match the real nav, so a
 * walkthrough never dead-ends a user on a 404.
 */

export interface WalkthroughStep {
  /** Route to send the user to. Omitted for steps done in place. */
  href?: string;
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

const ATTENDANCE = "Open Attendance from the sidebar";

/**
 * Keyed by `users.role`. Staff routinely hold several roles (see AGENTS.md), so
 * lookup walks the user's full role list and takes the first match — a headmaster
 * who also teaches gets the headmaster tour.
 */
export const WALKTHROUGHS: Record<string, Walkthrough> = {
  teacher: {
    id: "teacher",
    title: "Your first day, step by step",
    intro: "Four things, in the order you will do them. Skip any step you already know.",
    steps: [
      {
        href: "/dashboard/attendance",
        title: "Take the register",
        how: "Tap a pupil's row to mark them Present. Swipe right for Absent, swipe left for Late. There is also a one-pupil-at-a-time view if you are registering 40 children and cannot aim accurately.",
        done: "Each pupil's row shows a coloured status, and the summary at the top counts up.",
      },
      {
        href: "/dashboard/grades",
        title: "Enter marks for your subject",
        how: "Pick the class, tap your subject card, and type the continuous assessment mark. Save between pupils.",
        done: "The subject card fills up and the pupil's total and grade appear next to their name.",
      },
      {
        href: "/dashboard/homework",
        title: "Set homework",
        how: "Choose the class and subject, write the task, and set a due date. Each pupil submits their own.",
        done: "The homework appears in the list with submissions counted against it.",
      },
      {
        href: "/dashboard/classes",
        title: "Message a class or parent",
        how: "Pick recipients — a whole class or individual parents — and write the message. It queues and sends when there is signal. From here, use Messages in the sidebar if your role includes it.",
        done: "The message shows as Delivered or Queued in your sent list.",
      },
    ],
  },

  headmaster: {
    id: "headmaster",
    title: "Your first week as headmaster",
    intro: "Set up the school once, then check it is working. Everything after this is daily routine.",
    steps: [
      {
        href: "/dashboard/settings",
        title: "Finish the setup wizard",
        how: "Open Settings and run the setup wizard to set terms, grading and fees. The rest of the app reads from these, so nothing else works properly until they are set.",
        done: "The wizard reports complete and your dashboard numbers stop showing zero.",
      },
      {
        href: "/dashboard/staff",
        title: "Add your staff",
        how: "Add each staff member with their role. Anyone who also teaches or is a parent gets both roles ticked.",
        done: "They appear in the staff list and can sign in with the email you set.",
      },
      {
        href: "/dashboard/students",
        title: "Bring the pupils in",
        how: "Import from CSV for speed, or Add Student for individuals. The importer tells you which rows it skipped and why.",
        done: "Your roll shows pupils in the right classes with admission numbers.",
      },
      {
        href: "/dashboard/reports",
        title: "Print the first report cards",
        how: "Set the term and class, draft the headmaster remarks in bulk, then edit only the ones worth editing. Preview before printing.",
        done: "A preview matches the Uganda format, with your school's logo and colours.",
      },
    ],
  },

  bursar: {
    id: "bursar",
    title: "Fees and payments, start to finish",
    intro: "From setting a fee to taking payment and reporting on it.",
    steps: [
      {
        href: "/dashboard/fee-structure",
        title: "Set the fee structure",
        how: "Create the fee structure per class or term. Everything you record later is calculated from this.",
        done: "Each class shows what a pupil owes for the current term.",
      },
      {
        href: "/dashboard/fees",
        title: "Record a payment",
        how: "Open a pupil, then Payments, then Record Payment. Enter the amount and channel. The receipt number is generated for you.",
        done: "The balance falls and a receipt appears under that pupil's payments.",
      },
      {
        href: "/dashboard/fees",
        title: "Record a payment that is not cash",
        how: "Use the same dialog and pick the channel — bank transfer, mobile money, or a note for anything else.",
        done: "The payment shows under the right channel in the fee report.",
      },
      {
        href: "/dashboard/fees",
        title: "Send a reminder to those who have not paid",
        how: "Select the unpaid pupils and send. It goes by SMS to parents and is queued if you are offline.",
        done: "The reminder shows as sent or queued with the date.",
      },
    ],
  },

  admin: {
    id: "admin",
    title: "Setting the school up",
    intro: "The order that stops you coming back later to fix something.",
    steps: [
      {
        href: "/dashboard/settings",
        title: "Run the setup wizard",
        how: "Open Settings and run the setup wizard: terms, grading, fees, report layout. It reads as one job but unlocks four other features.",
        done: "The wizard reports complete.",
      },
      {
        href: "/dashboard/settings",
        title: "Create classes",
        how: "Classes are created in Settings, alongside the wizard. Assign a class teacher to each one. Marks and reports are recorded per class, so this comes first.",
        done: "Classes appear in the dropdown on Attendance, Grades and Reports.",
      },
      {
        href: "/dashboard/staff",
        title: "Add staff",
        how: "Add each staff member and give them every role they actually hold.",
        done: "They can sign in and see exactly the parts of the app their roles allow.",
      },
      {
        href: "/dashboard/students",
        title: "Import pupils",
        how: "Use the CSV importer for a whole class. It reports skipped rows with the reason, so nothing fails silently.",
        done: "The roll is complete and each pupil is in the right class.",
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
  intro: "The four screens you will use most.",
  steps: [
    {
      href: "/dashboard",
      title: "Your dashboard",
      how: "The numbers at the top are today's. Everything links through to the detail behind it.",
      done: "The dashboard shows your school, the current term, and today's numbers.",
    },
    {
      href: "/dashboard/attendance",
      title: "The register",
      how: "Tap to mark Present, swipe right for Absent, left for Late. Works with no signal.",
      done: "Coloured statuses appear against each pupil.",
    },
    {
      title: "Finding anything",
      how: "The search box at the top of the sidebar searches every page you have access to. Type two or three letters.",
      done: "Matching pages appear in the list as you type.",
    },
    {
      title: "Asking Owly",
      how: "Tap Owly in the bottom right and ask in plain language. He answers offline too.",
      done: "You get an answer with steps, and a link to the page it refers to.",
    },
  ],
};