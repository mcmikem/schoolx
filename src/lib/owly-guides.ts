/**
 * Every "How do I…?" answer, in one place.
 *
 * These were previously inline cards scattered across pages. Keeping the copy
 * here means the page only carries a button, Owly renders the steps, and a
 * wording fix does not need to be repeated on four screens.
 *
 * Answers are plain text with a deliberately tiny markup subset: `**bold**`,
 * numbered steps and blank lines. That is exactly what the assistant's local
 * formatter renders, so a guide works with no network and no AI key.
 */

export interface OwlyGuide {
  id: string;
  title: string;
  intro?: string;
  steps: string[];
  note?: string;
}

export const OWLY_GUIDES: Record<string, OwlyGuide> = {
  fees: {
    id: "fees",
    title: "How to manage fees",
    intro: "Everything starts from the Fees Tracker. Work in this order:",
    steps: [
      "**Create Fee:** set up fee items (Tuition, Development, etc.) per class and term.",
      "**Record Payment:** tap a pupil's row to record money received.",
      "**Get Receipt:** after saving a payment, print or share the receipt.",
      "**Send Reminders:** use Auto Fee Reminders to message parents with balances.",
      "**Adjustments:** add scholarships, fines or corrections without editing the original bill.",
    ],
    note: 'Balances carry forward each term. Never delete last term\'s fee rows to "start fresh" — that erases what a family still owes.',
  },
  students: {
    id: "students",
    title: "How to manage students",
    steps: [
      "**Add pupils** one by one, or import a whole class from a spreadsheet.",
      "**Transfers:** use Transfers when a pupil moves class or leaves the school.",
      "**Promotions:** move a class up at the end of the year from Promotions.",
      "**At-risk pupils:** the register flags attendance and fee concerns so you can follow up early.",
    ],
    note: "Importing is faster for a new class, and you can fix errors before anything is saved.",
  },
  staff: {
    id: "staff",
    title: "How to manage staff",
    steps: [
      "**Add Staff:** register teachers and non-teaching staff.",
      "**Assign Subjects:** link each teacher to the subjects they teach.",
      "**Class Teacher:** assign one teacher to lead each class.",
      "**Leave Requests:** staff request time off here, and you approve it.",
      "**Performance:** use Reviews to record observations and follow-ups.",
    ],
    note: "One person can hold more than one role — a headmaster who also teaches, or a bursar who is also a parent. Add every role; permissions combine.",
  },
  messages: {
    id: "messages",
    title: "How to use communication",
    steps: [
      "**Send messages:** choose Auto, WhatsApp or SMS for one parent, a class or the whole school.",
      "**Notices:** post announcements that selected groups can see.",
      "**Automation:** set automatic messages for attendance, fees and results.",
      "**Templates:** save frequent messages so they are quick to send again.",
      "**Recent Messages:** review delivery results and follow up on failures.",
    ],
    note: "SMS costs money per message. Check the recipient count before sending to the whole school.",
  },
  attendance: {
    id: "attendance",
    title: "How to mark attendance",
    intro: "Marking is one gesture per pupil:",
    steps: [
      "**Tap** a pupil's row to mark them Present.",
      "**Swipe right** to mark Absent.",
      "**Swipe left** for Late or Excused.",
      "Use **One pupil at a time** when the class list is crowded — it shows one large card instead of a long register.",
    ],
    note: "Attendance saves as you go and keeps working offline. It uploads by itself when there is signal.",
  },
  grades: {
    id: "grades",
    title: "How to enter marks",
    steps: [
      "One row per pupil. Type a mark into the BOT, MOT or EOT box — each is out of 100.",
      "Leave a box empty if you have not assessed that pupil yet, and come back later.",
      "Marks save as you move between boxes. Tap **Save Grades** when you are done.",
    ],
    note: "BOT and MOT are classwork; EOT is the end-of-term exam. They are kept separately and the report uses a simple average, not weights.",
  },
  "grades-terms": {
    id: "grades-terms",
    title: "What BOT, MOT and EOT mean",
    steps: [
      "**BOT and MOT — classwork.** Every test, beginning-of-term, midterm and Saturday mark counts equally.",
      "**EOT — end of term.** The end-of-term exam mark. It counts 75% of the subject average.",
      "**Average and grade.** BOT, MOT and EOT are stored separately; the report uses a simple average, not weights.",
    ],
  },
  "setup-school": {
    id: "setup-school",
    title: "Setting up your school",
    intro: "Use the name and district from your school records, then check the school type and subjects below.",
    steps: [
      "**School name:** your school's full name.",
      "**School type:** Primary, Secondary or Combined.",
      "**Optional details:** you can add a motto and contacts later.",
    ],
    note: "Use the official name on your school records so receipts and report cards match.",
  },
  "setup-fees": {
    id: "setup-fees",
    title: "Setting up terms and fees",
    intro: "Read the year, term and class carefully. A fee amount is for one learner, not the whole class.",
    steps: [
      "**Example class:** P.3 · Term 1.",
      "**Example fee:** Tuition: UGX 150,000 per learner.",
      "**Check dates:** use your school's approved calendar.",
    ],
    note: "Use the fee list your school approved. Do not guess amounts.",
  },
  "setup-grading": {
    id: "setup-grading",
    title: "Setting up grading",
    intro: "Choose the rules your school actually uses. Ask the headteacher if you do not know a grading setting.",
    steps: [
      "**Example mark:** 18 out of 20.",
      "**Zero:** the learner scored 0.",
      "**Blank:** no mark entered yet — not zero.",
    ],
    note: "A blank is different from a zero. Never enter 0 for a pupil who has not been assessed.",
  },
  "setup-services": {
    id: "setup-services",
    title: "Choosing school services",
    intro: "Turn on the school services you need. Do not add boarding details for a day-only school.",
    steps: [
      "**Day school:** no dormitory setup needed.",
      "**Boarding school:** check dormitory names and capacity.",
      "**Not sure?** Check with your school before continuing.",
    ],
  },
  "setup-review": {
    id: "setup-review",
    title: "Checking before you finish",
    intro: "Read your choices. Setup is not finished until you tap the finish button and the app confirms it.",
    steps: [
      "**Check school details:** name, subjects and school type.",
      "**Check money and dates:** term dates and fee amounts.",
      "**Finish once:** wait for a success message.",
    ],
    note: "If the app does not confirm, do not close the page — try again.",
  },
};

/** The guide a page should offer, if any. */
export function getGuide(id: string): OwlyGuide | null {
  return OWLY_GUIDES[id] ?? null;
}

/** Render a guide as assistant text. */
export function guideToMessage(guide: OwlyGuide): string {
  const lines: string[] = [`**${guide.title}**`];
  if (guide.intro) lines.push("", guide.intro);
  lines.push("");
  guide.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  if (guide.note) lines.push("", guide.note);
  return lines.join("\n");
}
