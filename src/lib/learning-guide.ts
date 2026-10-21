import type { OnboardingVideoKey } from "@/lib/onboarding-videos";

export type LearningTrack = "school" | "teacher" | "bursar" | "basics";
export interface LearningStep {
  title: string;
  instruction: string;
  example: string[];
  tip: string;
  practice?: "attendance" | "payment";
}
export interface LearningLesson {
  id: string;
  title: string;
  icon: string;
  href?: string;
  action?: string;
  /**
   * Optional short clip of this job on the real screen. The text lesson stays
   * the default -- a teacher on a metered connection is never pushed to
   * download video they did not ask for.
   */
  video?: OnboardingVideoKey;
  steps: LearningStep[];
}
export const TRACK_LABELS: Record<LearningTrack, string> = {
  school: "Set up a school",
  teacher: "Teach a class",
  bursar: "Record school fees",
  basics: "Use the app",
};

const basics: LearningLesson = {
  id: "phone-basics",
  title: "Start here: using your phone",
  icon: "smartphone",
  steps: [
    {
      title: "Tap once, then wait",
      instruction: "Tap a button once with your finger. If you see ‘Saving’, wait for the result before tapping again.",
      example: ["Tap Save once", "Wait while it says Saving", "Read the message on the screen"],
      tip: "A slow connection may take longer. Tapping Save many times can cause problems.",
    },
    {
      title: "Find your way back",
      instruction:
        "Home takes you to your main page. For Help, tap the small circle with your first letter at the top, then tap ‘Help: learn step by step’.",
      example: ["Home → your main page", "☰ Menu → other pages", "Your name → Help: learn step by step"],
      tip: "The phone’s Back button goes to the previous page. Check that your work was saved before leaving a form.",
    },
    {
      title: "Know when work is saved",
      instruction:
        "Only trust a save after the app confirms it. If you see a waiting-to-sync message, that work still needs a connection.",
      example: [
        "Saved → the app confirmed the save",
        "Waiting to sync → not uploaded yet",
        "Error or no answer → check the record before retrying",
      ],
      tip: "If the connection drops after a payment, check the receipt list first. Do not enter the same payment again just because you did not see an answer.",
    },
  ],
};

const school: LearningLesson[] = [
  {
    id: "school-setup",
    title: "Set up your school",
    icon: "school",
    href: "/dashboard/setup-wizard",
    action: "Open school setup",
    steps: [
      {
        title: "Keep your school records nearby",
        instruction: "You need your school name, term dates and fee list. You do not need to upload a logo to begin.",
        example: ["School name: Kijjabwemi Primary School", "School type: Primary", "District: Masaka"],
        tip: "These are examples. Use your own school’s details in the real setup form.",
      },
      {
        title: "Check each term and fee",
        instruction:
          "Use your school’s approved calendar and fee list. Check the year, class and term before continuing.",
        example: ["Class: P.3", "Term: 1", "Tuition for one learner: UGX 150,000"],
        tip: "UGX means Uganda shillings. A fee amount is what one learner owes, not the total for the whole class.",
      },
      {
        title: "Read before finishing",
        instruction:
          "Check the subjects, mark settings and school services. Tap Finish setup when the details are right. Wait for confirmation.",
        example: ["School details checked", "Dates and amounts checked", "Finish setup → wait for confirmation"],
        tip: "Opening this lesson does not set up your school. Use Open school setup when you are ready to enter real details.",
      },
    ],
  },
  {
    id: "first-learners",
    title: "Add your first learner",
    icon: "group",
    href: "/dashboard/students",
    action: "Open student records",
    steps: [
      {
        title: "Start with one learner",
        instruction:
          "Open student records and look for the add-student button. Enter one learner first, rather than a whole class.",
        example: ["First name: Amina", "Last name: Namatovu", "Class: P.3"],
        tip: "Use names as they appear in the school register. Search first if the learner may already be registered.",
      },
      {
        title: "Check the parent’s phone",
        instruction:
          "Enter the correct parent or guardian’s contact. Read the number back from the school register before saving.",
        example: [
          "Guardian: the learner’s parent or carer",
          "Phone: copy it from the register",
          "Class: check the correct year and stream",
        ],
        tip: "A wrong phone number can send a child’s information to the wrong person. Do not guess missing contacts.",
      },
      {
        title: "Save and find the learner",
        instruction: "Tap Save once. After confirmation, search for the learner’s name and check the class.",
        example: ["Save → wait for confirmation", "Search Amina", "Check that only the intended record was added"],
        tip: "A spreadsheet import can wait until you are comfortable adding and checking one learner.",
      },
    ],
  },
  {
    id: "staff-first-day",
    title: "Help a teacher start",
    icon: "badge",
    href: "/dashboard/staff",
    action: "Open staff records",
    steps: [
      {
        title: "Give each person their own account",
        instruction:
          "Add the teacher in staff records. Check the name, contact and job. Do not share the headteacher’s password.",
        example: ["Teacher: Mary", "Job: Teacher", "Contact: Mary’s own phone or email"],
        tip: "A teacher who is also a bursar needs both roles assigned to that person. Do not give every teacher finance access.",
      },
      {
        title: "Assign the correct class and subject",
        instruction:
          "Check the teacher’s class and subject assignments. A teacher with no assigned class may have nothing to mark.",
        example: ["Mary → P.3", "Subject → English", "Ask Mary to check her class list"],
        tip: "If the class is missing, check the assignment instead of creating a second teacher account.",
      },
      {
        title: "Let the teacher practise",
        instruction:
          "Ask the teacher to open Help and choose the attendance lesson. Practice examples do not change your school’s register.",
        example: ["Sign in with own account", "Open Help: learn step by step", "Practise marking attendance"],
        tip: "Help stays available after lessons are finished. A teacher can repeat a lesson at any time.",
      },
    ],
  },
];

const teacher: LearningLesson[] = [
  {
    id: "teacher-class",
    title: "Find your class",
    icon: "school",
    href: "/dashboard",
    action: "Open my main page",
    steps: [
      {
        title: "Check that this is your account",
        instruction: "Look at the name at the top of the page. Use your own account, especially on a shared phone.",
        example: ["Signed in: Mary", "School: your school", "Class: the class you teach"],
        tip: "Sign out when you finish using someone else’s phone. Do not save your password on a shared phone.",
      },
      {
        title: "Look for your assigned class",
        instruction:
          "Open your main page and look for your class. If you cannot find it, ask the headteacher to check your assignment.",
        example: ["My classes", "P.3 → English", "P.4 → English"],
        tip: "Do not choose another teacher’s class just because your class is missing.",
      },
    ],
  },
  {
    id: "teacher-attendance",
    title: "Mark who came to school",
    icon: "how_to_reg",
    video: "attendance",
    href: "/dashboard/attendance",
    action: "Open attendance",
    steps: [
      {
        title: "Check class and date first",
        instruction:
          "Open Attendance. Choose the class and the day you are recording. Read both before marking learners.",
        example: ["Class: P.3", "Date: the day being recorded", "Check names against your register"],
        tip: "When correcting yesterday’s register, choose yesterday’s date. Do not put it under today.",
      },
      {
        title: "Try marking one learner absent",
        instruction:
          "In this example, John did not come to school. Tap Absent beside his name. Amina came to school, so leave her Present.",
        example: [],
        practice: "attendance",
        tip: "This is a practice register. Nothing here is sent to a parent or saved to your school.",
      },
      {
        title: "Check the exceptions, then save",
        instruction: "In the real register, check absent and late learners. Tap Save once and wait for confirmation.",
        example: ["Correct class and date", "Absent and late names checked", "Save once → read the result"],
        tip: "Do not assume a parent has received an SMS. Message delivery is separate from saving attendance.",
      },
    ],
  },
  {
    id: "teacher-marks",
    title: "Enter marks without guessing",
    icon: "edit",
    video: "marks",
    href: "/dashboard/grades",
    action: "Open marks",
    steps: [
      {
        title: "Choose the right assessment",
        instruction: "Check the class, subject, term and test. Read the maximum mark before typing a score.",
        example: ["Class: P.3 · Subject: English", "Test: end-of-term exam", "Maximum: 100"],
        tip: "A test out of 20 and an exam out of 100 are different. Do not enter a percentage unless the form asks for one.",
      },
      {
        title: "Zero and missing are different",
        instruction:
          "Enter 0 only when the learner scored zero. If there is no mark yet, leave it blank and follow your school’s missing-mark procedure.",
        example: [
          "0 → a recorded score of zero",
          "Blank → no score entered yet",
          "25 out of 20 → check the score or maximum",
        ],
        tip: "Never fill missing marks with zero just to finish a report.",
      },
      {
        title: "Save, then check",
        instruction:
          "Save the marks and wait for confirmation. Reopen the assessment and check a few learners against your paper mark sheet.",
        example: ["Save once", "Wait for confirmation", "Check saved marks against the mark sheet"],
        tip: "A lesson marked as read is not proof that marks were saved or approved.",
      },
    ],
  },
];

const bursar: LearningLesson[] = [
  {
    id: "bursar-charges",
    title: "Check what each learner owes",
    icon: "payments",
    href: "/dashboard/fee-structure",
    action: "Open fee structure",
    steps: [
      {
        title: "Start with the approved fee list",
        instruction:
          "Check the class, term and year for each fee item. An amount on the fee list is not a payment received.",
        example: ["P.3 · Term 1", "Tuition: UGX 150,000 per learner", "Meals: a separate item if charged"],
        tip: "Ask the headteacher to confirm charges you are not authorised to change.",
      },
      {
        title: "Read the learner’s balance",
        instruction:
          "Open the learner’s account and compare the charges and recorded payments. Check any opening balance, discount or adjustment.",
        example: ["Amount owed before payment: UGX 50,000", "Payment received: UGX 20,000", "Amount left: UGX 30,000"],
        tip: "A dashboard estimate is not a reconciled account statement. Review the learner’s account before a dispute or refund.",
      },
    ],
  },
  {
    id: "bursar-payment",
    title: "Record a payment correctly",
    icon: "receipt_long",
    href: "/dashboard/fees",
    action: "Open fee payments",
    steps: [
      {
        title: "Find the correct learner",
        instruction:
          "Open fees, then Add Payment. Type the learner’s name and tap the matching result. Check the class before entering money.",
        example: ["Search: Amina", "Select: Amina Namatovu · P.3", "Check the selected learner"],
        tip: "Typing a name alone does not select a learner. Tap a result from the list.",
      },
      {
        title: "Try a payment with example money",
        instruction:
          "Amina owes UGX 50,000 in this example. Enter UGX 20,000 and save a practice receipt. No real money or school records are involved.",
        example: [],
        practice: "payment",
        tip: "In the real form, choose the date the money was paid. For mobile money, copy the transaction reference from the payment message.",
      },
      {
        title: "Check the receipt before recording again",
        instruction:
          "In the real app, tap Save once. Check the receipt, date and remaining balance after confirmation.",
        example: [
          "Payment date → when the money was paid",
          "Reference → bank or mobile-money transaction",
          "Receipt list → check before retrying",
        ],
        tip: "If saving times out, first check the ledger for the receipt. Do not record the same money twice.",
      },
    ],
  },
  {
    id: "bursar-check",
    title: "Check the day’s receipts",
    icon: "account_balance",
    href: "/dashboard/fee-ledger",
    action: "Open payment ledger",
    steps: [
      {
        title: "Compare records with money received",
        instruction: "Check cash, mobile-money and bank records separately. Read each receipt’s payment date.",
        example: [
          "Cash → compare with cash counted",
          "Mobile money → compare transaction references",
          "Bank → compare deposit records",
        ],
        tip: "The dashboard shows loaded receipts, which may not include every receipt. It is not a completed daily reconciliation.",
      },
      {
        title: "Ask before correcting a receipt",
        instruction:
          "If a learner, amount or date is wrong, follow your school’s correction process. Keep the original reference and explain the correction.",
        example: ["Find the receipt", "Compare with the original evidence", "Use the authorised correction process"],
        tip: "Do not add another payment to hide an incorrect one.",
      },
    ],
  },
];

export function learningTracks(user: { role?: string | null; roles?: readonly string[] | null }): LearningTrack[] {
  const roles = new Set([user.role, ...(user.roles || [])]);
  const tracks: LearningTrack[] = [];
  if (["headmaster", "admin", "school_admin"].some((role) => roles.has(role))) tracks.push("school");
  if (roles.has("teacher")) tracks.push("teacher");
  if (roles.has("bursar")) tracks.push("bursar");
  return tracks.length ? tracks : ["basics"];
}

export function learningLessons(track: LearningTrack): LearningLesson[] {
  return [basics, ...{ school, teacher, bursar, basics: [] }[track]];
}

export interface LearningProgress {
  lessonId: string;
  step: number;
  reviewed: string[];
}
export function learningStorageKey(schoolId: string, userId: string, track: LearningTrack): string {
  return `skm_learning_v1:${encodeURIComponent(schoolId)}:${encodeURIComponent(userId)}:${track}`;
}
export function readLearningProgress(raw: string | null, lessons: LearningLesson[]): LearningProgress {
  const fallback = { lessonId: lessons[0].id, step: 0, reviewed: [] };
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return fallback;
    const lesson = lessons.find((item) => item.id === parsed.lessonId) || lessons[0];
    return {
      lessonId: lesson.id,
      step: Number.isInteger(parsed.step) && parsed.step >= 0 && parsed.step < lesson.steps.length ? parsed.step : 0,
      reviewed: Array.isArray(parsed.reviewed)
        ? [
            ...new Set<string>(
              parsed.reviewed.filter((id: unknown) => typeof id === "string" && lessons.some((item) => item.id === id)),
            ),
          ]
        : [],
    };
  } catch {
    return fallback;
  }
}
